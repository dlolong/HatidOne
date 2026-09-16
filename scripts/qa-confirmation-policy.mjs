// Real disposable-local browser/Auth checks. Policy argument labels expectations;
// it never changes application behavior or passes a confirmation override to it.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { LocalChrome } from './qa-driver-registration-browser.mjs';
const policy = process.argv[2];
if (!['off','on','retry'].includes(policy)) throw Error('Use off, on, or retry (with confirmation off) for the disposable backend');
const env = JSON.parse(await readFile('.local-backend/registration-qa/web-env.json','utf8'));
const accounts = JSON.parse(await readFile('.local-backend/registration-qa/accounts.json','utf8'));
if (env.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:56321') throw Error('Only isolated registration QA is allowed');
const base='http://127.0.0.1:3139';
const client = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth:{persistSession:false,autoRefreshToken:false}});
const admin = client();
if ((await admin.auth.signInWithPassword({ email:'admin@hatidone.test', password:accounts['admin@hatidone.test'] })).error) throw Error('Isolated admin login unavailable');
const browser = new LocalChrome();
const results=[];const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function check(value,label) {if(!value)throw Error(`FAIL: ${label}`);results.push(label);console.log(`PASS: ${label}`);}
async function wait(expression,label) {for(let i=0;i<120;i++){if(await browser.evaluate(expression))return;await pause(150);}throw Error(`Timeout: ${label}`);}
async function fill(name,value) {await wait(`!!document.querySelector('[name="${name}"]')`,'input available');await browser.evaluate(`(()=>{const e=document.querySelector('[name="${name}"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);}
async function profile(email) {const result=await admin.from('profiles').select('id,role').eq('email',email).single();if(result.error)throw Error('Fixture profile unavailable');return result.data;}
async function application(id) {const result=await admin.from('driver_profiles').select('id,verification_status,online').eq('user_id',id);if(result.error)throw Error('Fixture application query failed');return result.data;}
async function confirmation(email) {
 for(let i=0;i<80;i++) {const list=await(await fetch('http://127.0.0.1:56324/api/v1/messages')).json();const message=list.messages.find(m=>m.To.some(t=>t.Address===email));if(message){const mail=await(await fetch(`http://127.0.0.1:56324/api/v1/message/${message.ID}`)).json();const link=(mail.HTML||mail.Text).match(/https?:[^\s"<>]+\/auth\/v1\/verify\?[^\s"<>]+/);if(link)return link[0].replaceAll('&amp;','&');}await pause(200);}throw Error('Local confirmation email unavailable');
}
try {
 for(const intent of (policy==='retry'?[]:['passenger','driver'])) {
  await browser.start();
  const email=`qa-policy-${policy}-${intent}-${randomBytes(5).toString('hex')}@hatidone.invalid`;
  const password=randomBytes(24).toString('base64url');
  await browser.navigate(`${base}/signup?intent=${intent}`);
  for(const [name,value] of [['firstName','Fictional'],['lastName','Policy Test'],['email',email],['password',password]])await fill(name,value);
  await browser.evaluate('document.querySelector("[name=email]").form.requestSubmit()');
  const destination=intent==='driver'?'/driver/onboarding':'/book';
  await wait(`location.pathname===${JSON.stringify(policy==='off'?destination:'/login')}`,'signup policy destination');
  const account=await profile(email);
  check(account.role==='passenger',`${policy} ${intent}: profile stays passenger; email policy never grants driver role`);
  if(policy==='off') {
   check(await browser.evaluate('!document.body.innerText.includes("Check your email")&&!document.body.innerText.includes("check your email")'),`off ${intent}: immediate session reaches destination without confirmation or extra login`);
   const cookies=await browser.send('Network.getAllCookies');
   check(cookies.cookies.some(c=>c.name.includes('auth-token')&&!c.name.includes('code-verifier')),`off ${intent}: session cookies persisted before protected SSR destination`);
  } else {
   check(await browser.evaluate(`new URLSearchParams(location.search).get('intent')===${JSON.stringify(intent)}`),`on ${intent}: no-session continuation retains selected journey`);
   check((await application(account.id)).length===0,`on ${intent}: no application created without session`);
   // Read-only unauthenticated visits cannot enter either protected journey.
   await browser.navigate(`${base}${destination}`);
   check(await browser.evaluate('location.pathname==="/login"||location.pathname==="/signup"'),`on ${intent}: protected pages deny the unconfirmed account`);
   await browser.navigate(await confirmation(email));
   await wait(`location.pathname===${JSON.stringify(intent==='driver'?'/driver-application':'/book')}`,'real confirmation callback');
   if(intent==='driver') {
    check((await application(account.id)).length===0,'on driver: callback GET does not create a draft');
    await wait('!![...document.querySelectorAll("button")].find(b=>b.innerText==="Start application")','start form');
    await browser.evaluate('[...document.querySelectorAll("button")].find(b=>b.innerText==="Start application").click()');
    await wait('location.pathname==="/driver/onboarding"','authenticated application start');
   }
   check(true,`on ${intent}: actual confirmation restores intended journey`);
  }
  await browser.navigate(`${base}${destination}`);
  check(await browser.evaluate(`location.pathname===${JSON.stringify(destination)}`),`${policy} ${intent}: refresh retains session and destination`);
  const auth=client();if((await auth.auth.signInWithPassword({email,password})).error)throw Error('Confirmed fixture login failed');
  if(intent==='driver') {
   const before=await application(account.id);
   check(before.length===1&&before[0].verification_status==='pending'&&!before[0].online,`${policy} driver: one unapproved offline application uses the same user`);
   for(let i=0;i<2;i++)check(!(await auth.rpc('request_driver_application')).error,`${policy} driver: authenticated repeat ${i+1} resumes application`);
   const after=await application(account.id);check(after.length===1&&after[0].id===before[0].id,`${policy} driver: repeated requests and reload do not duplicate or reset application`);
   check(Boolean((await auth.rpc('set_driver_availability',{p_online:true,p_latitude:14.55,p_longitude:121.05})).error),`${policy} driver: pending account cannot become dispatch-available`);
   check(Boolean((await auth.rpc('accept_ride_offer',{p_offer_id:crypto.randomUUID()})).error),`${policy} driver: pending account cannot accept trips`);
   check(Boolean((await auth.from('driver_profiles').update({verification_status:'verified'}).eq('id',before[0].id)).error),`${policy} driver: direct self-approval denied`);
   check(Boolean((await auth.from('profiles').update({role:'admin'}).eq('id',account.id)).error),`${policy} driver: direct role escalation denied`);
  }
  await browser.evaluate('[...document.querySelectorAll("button")].find(b=>b.innerText==="Sign out").click()');
  await wait('location.pathname==="/login"','logout');
  await browser.navigate(`${base}/login?intent=${intent}`);await fill('email',email);await fill('password',password);await browser.evaluate('document.querySelector("[name=password]").form.requestSubmit()');
  await wait(`location.pathname===${JSON.stringify(destination)}`,'login resumes existing journey');
  check(true,`${policy} ${intent}: logout/login returns to the same account journey`);
  const duplicate=await client().auth.signUp({email,password});
  check(!!duplicate.error||(!duplicate.data.session&&!!duplicate.data.user),`${policy} ${intent}: duplicate signup produces error or provider-safe unauthenticated response`);
  await browser.stop();
 }
 if(policy==='retry') {
  const privilege=verb=>execFileSync('docker',['exec','-i','supabase_db_hatidone-registration-qa','psql','-X','-qAt','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],{input:`${verb} execute on function public.request_driver_application() ${verb==='revoke'?'from':'to'} authenticated;`,stdio:['pipe','pipe','pipe']});
  const email=`qa-retry-${randomBytes(5).toString('hex')}@hatidone.invalid`;const password=randomBytes(24).toString('base64url');
  await browser.start();
  privilege('revoke');
  try {
   await browser.navigate(`${base}/signup?intent=driver`);
   for(const[name,value]of [['firstName','Fictional'],['lastName','Retry Test'],['email',email],['password',password]])await fill(name,value);
   await browser.evaluate('document.querySelector("[name=email]").form.requestSubmit()');
   await wait('location.pathname==="/driver-application"&&!!document.querySelector("[role=alert]")','same-account application retry state');
   const account=await profile(email);
   check((await application(account.id)).length===0&&account.role==='passenger','retry: actual application initialization failure leaves authenticated existing account and no partial draft');
   check(await browser.evaluate('document.body.innerText.includes("Your account is ready")'),'retry: failure offers action using current session, without another signup or login');
  } finally {privilege('grant');}
  const account=await profile(email);
  await browser.evaluate('[...document.querySelectorAll("button")].find(b=>b.innerText==="Start application").click()');
  await wait('location.pathname==="/driver/onboarding"','application retry succeeds');
  check((await application(account.id)).length===1,'retry: restored application service lets same user finish setup with one draft');
 }
 const invalid=await client().auth.signUp({email:'invalid-email',password:'x'});
 check(!!invalid.error&&!invalid.data.session,`${policy}: failed signup produces no authenticated success`);
} catch(error) {console.error(error.message);console.error('Safe browser state:',await browser.evaluate('({path:location.pathname,heading:document.querySelector("h1")?.innerText,alert:document.querySelector("[role=alert]")?.innerText})').catch(()=>({})));process.exitCode=1;}
finally {await browser.stop();await mkdir('docs/qa',{recursive:true});await writeFile(`docs/qa/confirmation-${policy}.json`,JSON.stringify({policy,passed:results.length,complete:!process.exitCode,results},null,2)+'\n');}
