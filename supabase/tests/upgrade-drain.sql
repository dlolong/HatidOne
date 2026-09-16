-- Verify refused upgrade changed nothing, then drain only the fictional active-state fixture.
do $$ begin
 if to_regclass('private.release_environment') is not null then raise exception 'FAIL: refused upgrade left partial RC1 schema'; end if;
 if not exists(select 1 from public.ride_requests where id='99000000-0000-4000-8000-000000000003' and status='assigned') then raise exception 'FAIL: refused upgrade changed active ride'; end if;
end $$;
select 'PASS: blocked upgrade leaves legacy schema and active ride intact';
begin;
select set_config('request.jwt.claim.sub','99000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.cancel_own_ride_request('99000000-0000-4000-8000-000000000003');
commit;
