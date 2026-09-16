do $$ begin
 if not exists(select 1 from public.ride_requests where id='99000000-0000-4000-8000-000000000002' and passenger_id='99000000-0000-4000-8000-000000000001' and pickup_address='Fictional upgrade pickup') then
  raise exception 'FAIL: upgrade did not preserve existing ride and owner';
 end if;
end $$;
select 'PASS: upgrade preserves pre-RC1 ride, address and ownership';
