import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const env=Object.fromEntries(readFileSync(new URL('../apps/web/.env.local',import.meta.url),'utf8').split('\n').filter(line=>line.includes('=')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];}));
const url=env.NEXT_PUBLIC_SUPABASE_URL;
if(url!=='http://127.0.0.1:55321' && url!=='http://localhost:55321')throw new Error('HTTP smoke writes ONLY to the isolated local demo backend.');
let assertions=0;
function check(condition,label){if(!condition)throw new Error(`FAIL: ${label}`);assertions++;console.log(`PASS: ${label}`);}
async function session(name){const client=createClient(url,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const {error}=await client.auth.signInWithPassword({email:`${name}@hatidone.test`,password:'DEMO-ONLY-HatidOne!42'});check(!error,`local Auth login ${name}${error?`: ${error.message}`:''}`);return client;}
async function rpc(client,name,args){const {data,error}=await client.rpc(name,args);if(error)throw new Error(`${name}: ${error.message}`);return data;}
const [passenger,driver,admin,outsider,partner,corporate,fleet]=await Promise.all(['passenger','driver','admin','outsider','partner','corporate','fleet'].map(session));
const payload={client_request_id:randomUUID(),pickup_address:'HTTP demo Manila pickup',pickup_lat:14.55,pickup_lng:121.05,dropoff_address:'HTTP demo Makati dropoff',dropoff_lat:14.56,dropoff_lng:121.06,vehicle_type:'sedan',service_type:'local',passenger_count:2,route_preference:'avoid_tolls',estimated_fare:1,driver_earnings:999999};
const ride=await rpc(passenger,'create_transport_request',{p_payload:payload});
check(typeof ride==='string','HTTP passenger creates booking');
check(await rpc(passenger,'create_transport_request',{p_payload:payload})===ride,'HTTP booking idempotency');
const fare=await passenger.from('ride_requests').select('gross_fare,platform_commission,driver_earnings').eq('id',ride).single();
check(!fare.error&&fare.data.gross_fare>1&&fare.data.platform_commission===0&&fare.data.driver_earnings===fare.data.gross_fare,'HTTP ignores client financial injection');
const hidden=await outsider.from('ride_requests').select('id').eq('id',ride);check(!hidden.error&&hidden.data.length===0,'HTTP outsider booking RLS');
const forged=await passenger.rpc('record_mock_payment_event',{p_ride_request_id:ride,p_event_id:randomUUID(),p_status:'paid'});check(!!forged.error,'HTTP passenger cannot set payment paid');
const scoped=await fleet.rpc('manual_assign_ride',{p_ride_request_id:ride,p_driver_id:'20000000-0000-4000-8000-000000000002',p_vehicle_id:'30000000-0000-4000-8000-000000000002'});check(!!scoped.error,'HTTP fleet cannot dispatch unrelated passenger ride');
await rpc(admin,'create_ride_offers',{p_ride_request_id:ride,p_radius_meters:null,p_offer_seconds:null});
const offers=await driver.from('ride_offers').select('id').eq('ride_request_id',ride).eq('status','pending');check(!offers.error&&offers.data.length===1,'HTTP eligible driver offer visibility');
await rpc(driver,'accept_ride_offer',{p_offer_id:offers.data[0].id});
const pin=await rpc(passenger,'get_passenger_trip_pin',{p_ride_request_id:ride});check(/^\d{6}$/.test(pin),'HTTP passenger-only pickup PIN');
check(!!(await driver.rpc('get_passenger_trip_pin',{p_ride_request_id:ride})).error,'HTTP driver cannot retrieve PIN');
const messageId=randomUUID();const message=await rpc(passenger,'send_ride_message',{p_ride_request_id:ride,p_body:'HTTP demo pickup instructions',p_client_message_id:messageId});check(message===await rpc(passenger,'send_ride_message',{p_ride_request_id:ride,p_body:'HTTP demo pickup instructions',p_client_message_id:messageId}),'HTTP chat idempotency');
const chatRead=await driver.from('ride_messages').select('body').eq('id',message);check(!chatRead.error&&chatRead.data?.[0]?.body==='HTTP demo pickup instructions','HTTP assigned driver can read chat');
await rpc(driver,'advance_trip',{p_ride_request_id:ride,p_action:'heading'});await rpc(driver,'advance_trip',{p_ride_request_id:ride,p_action:'arrived'});
check(await rpc(driver,'advance_trip',{p_ride_request_id:ride,p_action:'start',p_pin:'invalid'})==='driver_arrived','HTTP wrong PIN does not start');
check(await rpc(driver,'advance_trip',{p_ride_request_id:ride,p_action:'start',p_pin:pin})==='trip_started','HTTP correct PIN starts');
check(await rpc(driver,'advance_trip',{p_ride_request_id:ride,p_action:'complete'})==='trip_completed','HTTP trip completion');
check(await rpc(driver,'advance_trip',{p_ride_request_id:ride,p_action:'complete'})==='trip_completed','HTTP completion replay');
check(!!(await driver.rpc('advance_trip',{p_ride_request_id:ride,p_action:'start',p_pin:pin})).error,'HTTP completed trip restart blocked');
const referred=await rpc(passenger,'create_transport_request',{p_payload:{...payload,client_request_id:randomUUID(),partner_id:'50000000-0000-4000-8000-000000000002',external_reference:'HTTP-DEMO-REF'}});
const referrals=await rpc(partner,'get_partner_referrals',{p_organization_id:'50000000-0000-4000-8000-000000000002'});check(referrals.some(row=>row.id===referred)&&referrals.every(row=>!('passenger_id'in row)),'HTTP sanitized partner attribution');
const orgs=await corporate.from('organizations').select('id');check(!orgs.error&&orgs.data.length===1,'HTTP corporate isolation');
const sub=await rpc(admin,'admin_manage_subscription',{p_payload:{organization_id:'50000000-0000-4000-8000-000000000002',plan_id:'partner_business',status:'active',expires_at:new Date(Date.now()+40*86400000).toISOString(),billing_status:'waived'}});check(typeof sub==='string','HTTP manual subscription activation');
const eventId=randomUUID();const payment=await rpc(admin,'record_mock_payment_event',{p_ride_request_id:referred,p_event_id:eventId,p_status:'paid'});check(payment===await rpc(admin,'record_mock_payment_event',{p_ride_request_id:referred,p_event_id:eventId,p_status:'paid'}),'HTTP DEMO PAYMENT replay');
console.log(`HTTP smoke completed: ${assertions} checks passed. Demo records retained; npm run demo:reset restores fixtures.`);
