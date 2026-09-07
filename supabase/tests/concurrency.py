#!/usr/bin/env python3
"""Real concurrent transactions against the disposable SQL harness database only."""
from concurrent.futures import ThreadPoolExecutor
import subprocess
import sys
import uuid

container = sys.argv[1]
DB = 'hatidone_test'
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
