// Browser and RLS checks against the disposable local QA backend only.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { LocalChrome } from './qa-driver-registration-browser.mjs';
const env=JSON.parse(await readFile('.local-backend/registration-qa/web-env.json','utf8'));
const accounts=JSON.parse(await readFile('.local-backend/registration-qa/accounts.json','utf8'));
if(env.NEXT_PUBLIC_SUPABASE_URL!=='http://127.0.0.1:56321')throw Error('Disposable backend required');
const base='http://127.0.0.1:3139';
const client=()=>createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const admin=client();if((await admin.auth.signInWithPassword({email:'admin@hatidone.test',password:accounts['admin@hatidone.test']})).error)throw Error('Fixture admin login failed');
const results=[];const browser=new LocalChrome();const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function check(value,label){if(!value)throw Error(`FAIL: ${label}`);results.push(label);console.log(`PASS: ${label}`);}
async function wait(expression,label){for(let i=0;i<120;i++){if(await browser.evaluate(expression))return;await pause(150);}throw Error(`Timeout: ${label}`);}
async function fill(name,value){await wait(`!!document.querySelector('[name="${name}"]')`,'input');await browser.evaluate(`(()=>{const e=document.querySelector('[name="${name}"]');Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);}
async function select(name,value){await browser.evaluate(`(()=>{const e=document.querySelector('[name="${name}"]');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);}
async function navigate(path,heading){await browser.navigate(base+path);await wait(`document.querySelector('h1')?.innerText===${JSON.stringify(heading)}`,'page heading '+heading);}
try{
 await browser.start();await navigate('/login','Welcome back');
 await fill('email','admin@hatidone.test');await fill('password',accounts['admin@hatidone.test']);await browser.evaluate('document.querySelector("[name=password]").form.requestSubmit()');
 await wait('location.pathname==="/admin" && !!document.querySelector(".admin-metrics")','admin dashboard');check(true,'Admin login reaches the overview');
 const {data:drivers,error:driverError}=await admin.from('driver_profiles').select('id,user_id,verification_status').neq('verification_status','pending').order('created_at',{ascending:false});
 if(driverError||!drivers.length)throw Error('Submitted QA driver fixture required');
 const driver=drivers.find(item=>item.verification_status==='under_review')??drivers[0];
 const person=(await admin.from('profiles').select('first_name,last_name,email').eq('id',driver.user_id).single()).data;
 const heading=[person.first_name,person.last_name].filter(Boolean).join(' ');
 const pages=[['overview','/admin','Operations overview'],['drivers','/admin/drivers','Driver applications'],['driver-detail',`/admin/drivers/${driver.id}`,heading],['dispatch','/admin/dispatch','Dispatch queue'],['operations','/admin/operations','Keep scheduled trips dependable'],['account','/account','Administrator account']];
 await mkdir('docs/screenshots/admin',{recursive:true});
 for(const width of [360,390,430,768,1440]){
  await browser.send('Emulation.setDeviceMetricsOverride',{width,height:width<768?800:1000,deviceScaleFactor:1,mobile:false});
  for(const[name,path,title]of pages){
   await navigate(path,title);
   check(await browser.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),`${name}: no horizontal overflow at ${width}px`);
   const shot=await browser.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(`docs/screenshots/admin/${name}-${width}.png`,Buffer.from(shot.data,'base64'));
  }
 }
 await navigate('/account','Administrator account');
 check(await browser.evaluate('!document.querySelector("a[href=\'/driver-application\']")&&!document.querySelector("a[href=\'/history\']")'),'Admin account and menu omit passenger and driver-application actions');
 await navigate('/admin/drivers?status=all&q=doesnotexistadminqa','Driver applications');
 check(await browser.evaluate('document.body.innerText.includes("No matching applications")'),'Applicant search handles no matches');
 await navigate(`/admin/drivers?status=all&q=${encodeURIComponent(person.email)}`,'Driver applications');
 check(await browser.evaluate(`document.querySelector('.admin-driver-list')?.innerText.includes(${JSON.stringify(person.email)})`),'Applicant email search finds the expected driver');
 await navigate(`/admin/drivers/${driver.id}`,heading);
 check(await browser.evaluate('document.querySelector(".primary-nav [aria-current=page]")?.innerText==="Drivers"'),'Driver detail highlights Drivers navigation');
 check(await browser.evaluate('document.body.innerText.includes("Applicant details")&&document.body.innerText.includes("Private documents")&&document.body.innerText.includes("Review decision")'),'Review includes applicant, documents and explicit decision');
 const privateHref=await browser.evaluate('document.querySelector(".admin-document a")?.href');
 if(privateHref){check(new URL(privateHref).hostname==='127.0.0.1'&&(await fetch(privateHref)).ok,'Admin private document link loads');}
 await navigate('/admin/operations#system','Keep scheduled trips dependable');
 await wait('document.querySelector("[role=tab][aria-selected=true]")?.innerText==="System"','system tab');
 await browser.evaluate('document.querySelector("[name=default_matching_radius_km]").form.requestSubmit()');
 await wait('location.search.includes("message=")&&location.hash==="#system"','configuration saved');
 check(await browser.evaluate('document.querySelector("[role=tab][aria-selected=true]")?.innerText==="System"'),'Configuration save returns to System with a success message');
 await navigate('/admin/operations#business','Keep scheduled trips dependable');
 await wait('document.querySelector("[role=tab][aria-selected=true]")?.innerText==="Business"','business tab');
 check(await browser.evaluate('!!document.querySelector("[name=organization_id]")'),'Business subscriptions load');
 const orgs=(await admin.from('organizations').select('id,kind')).data;const plans=(await admin.from('subscription_plans').select('id,audience').eq('active',true)).data;
 for(const org of orgs){await select('organization_id',org.id);await pause(80);const options=await browser.evaluate('[...document.querySelector("[name=plan_id]").options].map(o=>o.value).filter(Boolean)');check(options.every(id=>plans.some(plan=>plan.id===id&&plan.audience===org.kind)),`Subscription plans match ${org.kind} businesses`);}
 // Check the real RPC and RLS boundary using an ordinary authenticated passenger.
 const passenger=client();if((await passenger.auth.signInWithPassword({email:'passenger@hatidone.test',password:accounts['passenger@hatidone.test']})).error)throw Error('Passenger fixture login failed');
 const denied=await passenger.rpc('admin_review_driver',{p_driver_id:driver.id,p_decision:'verified',p_reason:null});check(!!denied.error,'Passenger cannot call the admin review mutation');
 const docs=await passenger.from('driver_documents').select('id').eq('driver_id',driver.id);check(!docs.error&&docs.data.length===0,'RLS hides another applicant’s private documents');
 await browser.evaluate('[...document.querySelectorAll("button")].find(b=>b.innerText==="Sign out").click()');await wait('location.pathname==="/login"','logout');
 await navigate('/login','Welcome back');await fill('email','passenger@hatidone.test');await fill('password',accounts['passenger@hatidone.test']);await browser.evaluate('document.querySelector("[name=password]").form.requestSubmit()');await wait('location.pathname!=="/login"','passenger login');
 await browser.navigate(`${base}/admin/drivers/${driver.id}`);check(await browser.evaluate('!location.pathname.startsWith("/admin")&&!document.querySelector(".admin-document")'),'Passenger cannot open admin driver detail');
 await writeFile('docs/qa/admin-workspace.json',JSON.stringify({checkedAt:new Date().toISOString(),environment:'disposable local backend',checks:results},null,2)+'\n');
 console.log(`Admin browser/API checks passed: ${results.length}`);
}finally{await browser.stop();}
