-- LOCAL DEVELOPMENT ONLY. Fictional accounts; shared password is DEMO-ONLY-HatidOne!42.
-- Supabase CLI local reset invokes this file. Never run against a production project.
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
select ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',email,
 private.hash_pin('DEMO-ONLY-HatidOne!42',private.pin_salt()),now(),'{"provider":"email","providers":["email"]}',jsonb_build_object('first_name',name,'last_name','Demo'),now(),now(),'','','',''
from (values(1,'passenger@hatidone.test','Passenger'),(2,'driver@hatidone.test','Verified Driver'),(3,'pending-driver@hatidone.test','Pending Driver'),(4,'admin@hatidone.test','Operations'),(5,'fleet@hatidone.test','Fleet Owner'),(6,'partner@hatidone.test','Resort Partner'),(7,'corporate@hatidone.test','Corporate Manager'),(8,'rider@hatidone.test','Employee'),(9,'backup-driver@hatidone.test','Backup Driver'),(10,'outsider@hatidone.test','Unrelated Passenger')) users(n,email,name)
on conflict(id) do nothing;
insert into auth.identities(id,user_id,provider_id,provider,identity_data,created_at,updated_at)
select id,id,id::text,'email',jsonb_build_object('sub',id::text,'email',email,'email_verified',true),now(),now() from auth.users where email like '%@hatidone.test' on conflict(provider_id,provider) do nothing;
update public.profiles set role=case when id in ('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000009') then 'driver'::public.user_role when id='10000000-0000-4000-8000-000000000004' then 'admin'::public.user_role when id='10000000-0000-4000-8000-000000000005' then 'fleet_admin'::public.user_role else 'passenger'::public.user_role end,account_status='active' where email like '%@hatidone.test';
insert into public.driver_profiles(id,user_id,verification_status,online,current_location,rating,rating_count)
select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,case when n=3 then 'pending'::public.verification_status else 'verified'::public.verification_status end,n<>3,public.st_setsrid(public.st_makepoint(121.05,14.55),4326)::public.geography,4.8,24 from (values(2),(3),(9)) numbers(n) on conflict(id) do nothing;
insert into public.fleets(id,owner_user_id,business_name,verification_status) values('60000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','Fictional Sunrise Demo Fleet','verified') on conflict(id) do nothing;
insert into public.organizations(id,kind,name,owner_user_id,partner_type,fleet_id) values
('50000000-0000-4000-8000-000000000001','fleet','Fictional Sunrise Demo Fleet','10000000-0000-4000-8000-000000000005',null,'60000000-0000-4000-8000-000000000001'),
('50000000-0000-4000-8000-000000000002','partner','Fictional Bay Demo Resort','10000000-0000-4000-8000-000000000006','resort',null),
('50000000-0000-4000-8000-000000000003','corporate','Fictional Acme Demo Company','10000000-0000-4000-8000-000000000007',null,null) on conflict(id) do nothing;
insert into public.organization_members(organization_id,user_id,member_role) select id,owner_user_id,'owner' from public.organizations on conflict(organization_id,user_id) do nothing;
insert into public.organization_members(organization_id,user_id,member_role) values('50000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000008','rider') on conflict(organization_id,user_id) do nothing;
insert into public.organization_locations(organization_id,label,address,latitude,longitude) values('50000000-0000-4000-8000-000000000002','Demo resort pickup','Fictional Bay Demo Resort, Batangas',13.76,121.05);
insert into public.vehicles(id,owner_user_id,fleet_id,vehicle_type,brand,model,year,color,plate_number,capacity,verified)
select ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'60000000-0000-4000-8000-000000000001','sedan','Demo','Fictional Sedan',2025,'Silver','DEMO-'||n,4,n<>3 from(values(2),(3),(9)) numbers(n) on conflict(id) do nothing;
insert into public.driver_vehicles(driver_id,vehicle_id,is_primary) select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,true from(values(2),(3),(9)) numbers(n) on conflict(driver_id,vehicle_id) do nothing;
-- Seed metadata intentionally denotes fictional documents. It is not evidence of production verification.
insert into storage.objects(bucket_id,name,owner_id)
select bucket,('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))||'/DEMO-ONLY.pdf',('10000000-0000-4000-8000-'||lpad(n::text,12,'0')) from(values(2),(9)) numbers(n) cross join(values('driver-documents'),('vehicle-documents')) buckets(bucket) on conflict(bucket_id,name) do nothing;
insert into public.driver_documents(driver_id,document_type,storage_path,expires_on,verification_status) select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'drivers_license',('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))||'/DEMO-ONLY.pdf',current_date+365,'verified' from(values(2),(9)) numbers(n) on conflict(driver_id,document_type) do nothing;
insert into public.vehicle_documents(vehicle_id,document_type,storage_path,expires_on,verification_status) select ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'registration',('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))||'/DEMO-ONLY.pdf',current_date+365,'verified' from(values(2),(9)) numbers(n) on conflict(vehicle_id,document_type) do nothing;
update public.app_config set demo_mode=true,mock_payment_enabled=true,mock_notifications_enabled=true where id;
insert into public.driver_preferences(driver_id,going_home_enabled,home_address,home_latitude,home_longitude,going_home_departure,preferred_areas,destination_areas)
values('20000000-0000-4000-8000-000000000002',true,'Demo home area, Metro Manila',14.6,121.0,now()+interval '8 hours',array['Metro Manila','Batangas'],array['Metro Manila']) on conflict(driver_id) do nothing;
insert into public.ride_requests(id,passenger_id,pickup_address,pickup_location,dropoff_address,dropoff_location,service_type,vehicle_type,scheduled_at,estimated_distance_meters,estimated_duration_seconds,estimated_fare,status,passenger_count,organization_id)
select ('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'10000000-0000-4000-8000-000000000001',pickup,public.st_setsrid(public.st_makepoint(121.05,case when n=4 then 13.76 else 14.55 end),4326)::public.geography,dropoff,public.st_setsrid(public.st_makepoint(121.05,case when n=4 then 14.55 else 13.76 end),4326)::public.geography,'scheduled','sedan',now()+make_interval(hours=>hours),88000,10800,1704,'requested',2,org::uuid
from(values(1,'Demo airport pickup','Fictional Bay Demo Resort',24,null),(2,'Demo city pickup','Fictional Bay Demo Resort',48,null),(3,'Demo airport pickup','Fictional Bay Demo Resort',-4,null),(4,'Fictional Bay Demo Resort','Demo Manila return',54,null),(5,'Fictional corporate office','Demo airport pickup',72,'50000000-0000-4000-8000-000000000003')) rides(n,pickup,dropoff,hours,org) on conflict(id) do nothing;
insert into public.ride_offers(ride_request_id,driver_id,vehicle_id,expires_at,distance_meters) values('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002',now()+interval '7 days',1200) on conflict(ride_request_id,driver_id) do nothing;
update public.ride_requests set status='offered' where id='40000000-0000-4000-8000-000000000001' and status='requested';
insert into public.ride_assignments(ride_request_id,driver_id,vehicle_id,fleet_id,assignment_type) select ('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000001','admin' from(values(2),(3)) numbers(n) on conflict(ride_request_id) do nothing;
update public.ride_requests set status='assigned' where id in ('40000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000003') and status='requested';
do $$ declare pin text; begin
 if exists(select 1 from public.ride_requests where id='40000000-0000-4000-8000-000000000003' and status='assigned') then
 perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
 perform public.advance_trip('40000000-0000-4000-8000-000000000003','heading');
 perform public.advance_trip('40000000-0000-4000-8000-000000000003','arrived');
 select s.pin into pin from private.trip_secrets s where ride_request_id='40000000-0000-4000-8000-000000000003';
 perform public.advance_trip('40000000-0000-4000-8000-000000000003','start',pin);
 perform public.advance_trip('40000000-0000-4000-8000-000000000003','complete');
 perform set_config('request.jwt.claim.sub','',true);
 end if;
end $$;
insert into public.organization_subscriptions(organization_id,plan_id,status,expires_at,billing_status) select id,case kind when 'fleet' then 'fleet_free' when 'partner' then 'partner_starter' else 'corporate_business' end,'trial',now()+interval '30 days','waived' from public.organizations on conflict(organization_id) do nothing;
insert into public.notifications(user_id,title,body) values('10000000-0000-4000-8000-000000000001','Welcome to the local demo','All people and businesses in this environment are fictional.'),('10000000-0000-4000-8000-000000000002','Trips going your way','Open Jobs to review a scheduled transfer and return candidate.');
commit;
