#!/usr/bin/env python3
"""Real concurrent transactions against the disposable SQL harness database only."""
from concurrent.futures import ThreadPoolExecutor
import subprocess
import sys
import uuid

container = sys.argv[1]
DB = sys.argv[2] if len(sys.argv) > 2 else 'hatidone_test'
if not container.startswith('hatidone-sql-test-') or DB not in ('hatidone_test', 'hatidone_upgrade'):
    raise SystemExit('Concurrency tests require the disposable test harness.')
DRIVER = '10000000-0000-4000-8000-000000000002'
BACKUP = '10000000-0000-4000-8000-000000000009'
PASSENGER = '10000000-0000-4000-8000-000000000001'

def sql(query: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(['docker', 'exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'supabase_admin', '-d', DB, '-At'], input=query, text=True, capture_output=True, check=False)

def require(query: str) -> str:
    result = sql(query)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()

def ride(days: int) -> str:
    ride_id = str(uuid.uuid4())
    require(f"""insert into public.ride_requests(id,passenger_id,pickup_address,pickup_location,dropoff_address,dropoff_location,service_type,vehicle_type,scheduled_at,estimated_distance_meters,estimated_duration_seconds,estimated_fare,status)
    select '{ride_id}',passenger_id,pickup_address,pickup_location,dropoff_address,dropoff_location,service_type,vehicle_type,now()+interval '{days} days',estimated_distance_meters,estimated_duration_seconds,estimated_fare,'requested' from public.ride_requests where id='40000000-0000-4000-8000-000000000001';
    update public.ride_requests set status='offered' where id='{ride_id}';""")
    return ride_id

def offer(ride_id: str, suffix: str) -> str:
    return require(f"insert into public.ride_offers(ride_request_id,driver_id,vehicle_id,expires_at) values('{ride_id}','20000000-0000-4000-8000-{suffix}','30000000-0000-4000-8000-{suffix}',now()+interval '1 hour') returning id;").splitlines()[0]

def actor(user: str, action: str) -> str:
    return f"begin; select set_config('request.jwt.claim.sub','{user}',true); set local role authenticated; {action}; select pg_sleep(0.3); commit;"

def parallel(first: str, second: str) -> list[subprocess.CompletedProcess[str]]:
    with ThreadPoolExecutor(max_workers=2) as pool:
        return list(pool.map(sql, [first, second]))

first_ride, second_ride = ride(12), ride(12)
a, b = offer(first_ride, '000000000002'), offer(second_ride, '000000000002')
results = parallel(actor(DRIVER, f"select public.accept_ride_offer('{a}')"), actor(DRIVER, f"select public.accept_ride_offer('{b}')"))
assert sum(r.returncode == 0 for r in results) == 1, [r.stderr for r in results]
assert any('no longer eligible' in r.stderr for r in results), [r.stderr for r in results]
assert require(f"select count(*) from public.ride_assignments where ride_request_id in ('{first_ride}','{second_ride}')") == '1'
print('PASS: simultaneous same-driver overlapping accepts produce one assignment')

shared_ride = ride(14)
a, b = offer(shared_ride, '000000000002'), offer(shared_ride, '000000000009')
results = parallel(actor(DRIVER, f"select public.accept_ride_offer('{a}')"), actor(BACKUP, f"select public.accept_ride_offer('{b}')"))
assert sum(r.returncode == 0 for r in results) == 1, [r.stderr for r in results]
assert require(f"select count(*) from public.ride_assignments where ride_request_id='{shared_ride}'") == '1'
print('PASS: two drivers accepting the same ride produce one winner')

cancelled = ride(16)
a = offer(cancelled, '000000000002')
results = parallel(actor(DRIVER, f"select public.accept_ride_offer('{a}')"), actor(PASSENGER, f"select public.cancel_own_ride_request('{cancelled}')"))
assert results[1].returncode == 0, results[1].stderr
assert results[0].returncode == 0 or 'no longer available' in results[0].stderr, results[0].stderr
assert require(f"select status from public.ride_requests where id='{cancelled}'") == 'passenger_cancelled'
assert require(f"select count(*)<=1 from public.ride_assignments where ride_request_id='{cancelled}'") == 't'
print('PASS: passenger cancellation racing driver acceptance ends cancelled')

payload = "jsonb_build_object('client_request_id','88000000-0000-4000-8000-000000000020','pickup_address','Fictional concurrent pickup','pickup_lat',14.55,'pickup_lng',121.05,'dropoff_address','Fictional concurrent dropoff','dropoff_lat',13.76,'dropoff_lng',121.05,'vehicle_type','sedan','service_type','scheduled','scheduled_at','2030-01-01T00:00:00Z')"
# Use one canonical server-generated timestamp in both otherwise identical payloads.
schedule = require("select to_char((now()+interval '21 days') at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"');")
payload = payload.replace('2030-01-01T00:00:00Z', schedule)
results = parallel(actor(PASSENGER, f"select public.create_transport_request({payload})"), actor(PASSENGER, f"select public.create_transport_request({payload})"))
assert all(r.returncode == 0 for r in results), [r.stderr for r in results]
assert require("select count(*) from public.ride_requests where client_request_id='88000000-0000-4000-8000-000000000020'") == '1'
print('PASS: simultaneous same-operation booking submissions create exactly one ride')

completed = '40000000-0000-4000-8000-000000000003'
results = parallel(actor(DRIVER, f"select public.record_cash_collection('{completed}','{uuid.uuid4()}','reported',1704,'Fictional concurrent cash')"), actor(DRIVER, f"select public.record_cash_collection('{completed}','{uuid.uuid4()}','reported',1704,'Fictional concurrent cash')"))
assert sum(r.returncode == 0 for r in results) == 1, [r.stderr for r in results]
assert any('already recorded' in r.stderr for r in results), [r.stderr for r in results]
assert require(f"select count(*) from public.cash_collection_events where ride_request_id='{completed}' and kind='reported'") == '1'
print('PASS: concurrent different-operation cash submissions create exactly one report')

# A request starts while valid, then waits behind the ride lock until the offer expires.
# Expiry must use the actual time after lock acquisition, not transaction-start now().
import time
expiring = ride(26)
expiring_offer = offer(expiring, '000000000002')
blocker = subprocess.Popen(['docker', 'exec', '-i', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'supabase_admin', '-d', DB], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
try:
    assert blocker.stdin is not None and blocker.stdout is not None
    blocker.stdin.write(f"begin; set local idle_in_transaction_session_timeout='60s'; select id from public.ride_requests where id='{expiring}' for update; select 'LOCKED';\n")
    blocker.stdin.flush()
    assert blocker.stdout.readline().strip() == expiring
    assert blocker.stdout.readline().strip() == 'LOCKED'
    require(f"update public.ride_offers set expires_at=clock_timestamp()+interval '500 milliseconds' where id='{expiring_offer}';")
    with ThreadPoolExecutor(max_workers=1) as pool:
        waiting = pool.submit(sql, actor(DRIVER, f"select public.accept_ride_offer('{expiring_offer}')"))
        try:
            for _ in range(40):
                locked = require(f"select exists(select 1 from pg_stat_activity where pid<>pg_backend_pid() and query like '%{expiring_offer}%' and wait_event_type='Lock');")
                if locked == 't':
                    break
                time.sleep(0.05)
            else:
                raise AssertionError('Could not observe acceptance waiting for ride lock')
            require("select pg_sleep(0.6);")
        finally:
            blocker.communicate('commit;\n', timeout=10)
        response = waiting.result(timeout=30)
    assert blocker.returncode == 0
finally:
    if blocker.poll() is None:
        blocker.communicate('rollback;\n', timeout=10)
assert response.returncode != 0 and 'offer expired' in response.stderr, response.stderr or 'Expired offer accepted after waiting for lock'
assert require(f"select count(*) from public.ride_assignments where ride_request_id='{expiring}'") == '0'
print('PASS: offer expiring during lock wait cannot be accepted')

applicant = str(uuid.uuid4())
require(f"insert into auth.users(id,email,raw_user_meta_data) values('{applicant}','concurrent-application@hatidone.invalid','{{\"first_name\":\"Concurrent\",\"last_name\":\"Applicant\",\"intent\":\"driver\",\"role\":\"admin\",\"verification_status\":\"verified\"}}');")
assert require(f"select role from public.profiles where id='{applicant}'") == 'passenger'
assert require(f"select count(*) from public.driver_profiles where user_id='{applicant}'") == '0'
print('PASS: forged signup intent/role/review metadata cannot grant privileges or create an application')
results = parallel(actor(applicant, "select public.request_driver_application()"), actor(applicant, "select public.request_driver_application()"))
assert all(result.returncode == 0 for result in results), [result.stderr for result in results]
assert require(f"select count(*) from public.driver_profiles where user_id='{applicant}' and verification_status='pending' and not online") == '1'
assert require(f"select role from public.profiles where id='{applicant}'") == 'passenger'
assert require(f"select count(*) from public.audit_events where actor_user_id='{applicant}' and action='driver_application_requested'") == '1'
print('PASS: concurrent application bootstrap creates one own pending draft and one audit event without changing passenger role')

# Observe actual lock waits, then prove an applicant write cannot cross submission/review.
require(actor(applicant, "select public.save_driver_profile('09170000003','Fictional race area'); select public.save_driver_vehicle('sedan','Fictional','Race Car',2025,'White','QA-RACE-ONLY',4)"))
application = require(f"select id from public.driver_profiles where user_id='{applicant}'")
vehicle = require(f"select id from public.vehicles where owner_user_id='{applicant}'")
require(f"insert into storage.objects(bucket_id,name,owner_id) values('driver-documents','{applicant}/race.pdf','{applicant}'),('vehicle-documents','{applicant}/race.pdf','{applicant}');")
require(actor(applicant, f"select public.record_driver_document('drivers_license','{applicant}/race.pdf',current_date+365); select public.record_vehicle_document('{vehicle}','registration','{applicant}/race.pdf',current_date+365)"))

def write_waits_then_rejects(owner: str, mutation: str, label: str) -> None:
    blocker = subprocess.Popen(['docker','exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d',DB],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    marker = str(uuid.uuid4())
    try:
        assert blocker.stdin and blocker.stdout
        blocker.stdin.write(f"begin; set local idle_in_transaction_session_timeout='60s'; select set_config('request.jwt.claim.sub','{owner}',true); set local role authenticated; {mutation}; select 'LOCKED';\n")
        blocker.stdin.flush()
        for _ in range(5):
            if blocker.stdout.readline().strip() == 'LOCKED': break
        else: raise AssertionError('Application transition failed before lock wait')
        with ThreadPoolExecutor(max_workers=1) as pool:
            waiting = pool.submit(sql,actor(applicant,f"select public.save_driver_profile('09170000004','{marker}')"))
            try:
                for _ in range(60):
                    if require(f"select exists(select 1 from pg_stat_activity where pid<>pg_backend_pid() and query like '%{marker}%' and wait_event_type='Lock')") == 't': break
                    time.sleep(0.05)
                else: raise AssertionError('Could not observe applicant edit waiting on application lock')
            finally: blocker.communicate('commit;\n',timeout=10)
            result=waiting.result(timeout=30)
        assert blocker.returncode == 0
        assert result.returncode != 0 and 'locked' in result.stderr, 'Applicant edit crossed locked application transition'
        assert require(f"select preferred_area='Fictional race area' from public.driver_profiles where user_id='{applicant}'") == 't'
        print('PASS: '+label)
    finally:
        if blocker.poll() is None: blocker.communicate('rollback;\n',timeout=10)

write_waits_then_rejects(applicant,'select public.submit_driver_onboarding()','applicant edit waiting behind submission is rejected after under-review commit')
write_waits_then_rejects('10000000-0000-4000-8000-000000000004',f"select public.admin_review_driver('{application}','verified')",'applicant edit waiting behind trusted approval is rejected after verified commit')

# A passenger booking may pass its initial role check before approval commits.
# The insertion guard must recheck under the same profile lock.
require(f"update public.profiles set role='passenger' where id='{applicant}'; update public.driver_profiles set verification_status='under_review' where id='{application}';")
race_operation = str(uuid.uuid4())
race_payload = payload.replace('88000000-0000-4000-8000-000000000020',race_operation)
blocker = subprocess.Popen(['docker','exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d',DB],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
    assert blocker.stdin and blocker.stdout
    blocker.stdin.write(f"begin; set local idle_in_transaction_session_timeout='60s'; select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true); set local role authenticated; select public.admin_review_driver('{application}','verified'); select 'LOCKED';\n")
    blocker.stdin.flush()
    for _ in range(5):
        if blocker.stdout.readline().strip() == 'LOCKED': break
    else: raise AssertionError('Approval did not acquire transition locks')
    with ThreadPoolExecutor(max_workers=1) as pool:
        waiting=pool.submit(sql,actor(applicant,f'select public.create_transport_request({race_payload})'))
        try:
            for _ in range(60):
                if require(f"select exists(select 1 from pg_stat_activity where pid<>pg_backend_pid() and query like '%{race_operation}%' and wait_event_type='Lock')")=='t':break
                time.sleep(0.05)
            else:raise AssertionError('Could not observe booking waiting behind role transition')
        finally:blocker.communicate('commit;\n',timeout=10)
        result=waiting.result(timeout=30)
    assert blocker.returncode==0
    assert result.returncode!=0 and 'passenger role required' in result.stderr, 'Booking crossed role transition'
    assert require(f"select count(*) from public.ride_requests where client_request_id='{race_operation}'")=='0'
    print('PASS: booking checked before approval but waiting on its lock is rejected after driver role commits')
finally:
    if blocker.poll() is None:blocker.communicate('rollback;\n',timeout=10)
