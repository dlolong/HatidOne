-- Pre-RC1 row written under the actual 0008 schema; no production data.
insert into auth.users(id,email,raw_user_meta_data)
values ('99000000-0000-4000-8000-000000000001','upgrade-only@hatidone.invalid','{"first_name":"Upgrade fixture"}');
insert into public.ride_requests(id,passenger_id,pickup_address,pickup_location,dropoff_address,dropoff_location,service_type,vehicle_type,scheduled_at,estimated_distance_meters,estimated_duration_seconds,estimated_fare,status)
values ('99000000-0000-4000-8000-000000000002','99000000-0000-4000-8000-000000000001','Fictional upgrade pickup',public.st_setsrid(public.st_makepoint(121.05,14.55),4326)::public.geography,'Fictional upgrade destination',public.st_setsrid(public.st_makepoint(121.05,13.76),4326)::public.geography,'scheduled','sedan',now()+interval '25 days',88000,10800,1704,'requested');
-- Representative legacy active state: the migration must refuse to touch it.
insert into public.ride_requests(id,passenger_id,pickup_address,pickup_location,dropoff_address,dropoff_location,service_type,vehicle_type,scheduled_at,estimated_distance_meters,estimated_duration_seconds,estimated_fare,status)
select '99000000-0000-4000-8000-000000000003',passenger_id,pickup_address,pickup_location,dropoff_address,dropoff_location,service_type,vehicle_type,scheduled_at+interval '2 days',estimated_distance_meters,estimated_duration_seconds,estimated_fare,'requested' from public.ride_requests where id='99000000-0000-4000-8000-000000000002';
update public.ride_requests set status='assigned' where id='99000000-0000-4000-8000-000000000003';
