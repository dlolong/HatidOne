// Uses only existing fictional fixtures in the disposable QA backend.
import { readFile, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { LocalChrome } from './qa-driver-registration-browser.mjs';
const env=JSON.parse(await readFile('.local-backend/registration-qa/web-env.json','utf8'));
const accounts=JSON.parse(await readFile('.local-backend/registration-qa/accounts.json','utf8'));
if(env.NEXT_PUBLIC_SUPABASE_URL!=='http://127.0.0.1:56321')throw Error('Disposable backend required');
const admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
if((await admin.auth.signInWithPassword({email:'admin@hatidone.test',password:accounts['admin@hatidone.test']})).error)throw Error('Fixture login unavailable');
const driver=(await admin.from('driver_profiles').select('id').eq('verification_status','verified').eq('online',false).limit(1).single()).data;
if(!driver)throw Error('Verified offline fixture required');
const browser=new LocalChrome();const base='http://127.0.0.1:3139';const results=[];let needsRestore=false;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function check(value,label){if(!value)throw Error('FAIL: '+label);results.push(label);console.log('PASS: '+label);}
async function wait(expression,label){for(let i=0;i<120;i++){if(await browser.evaluate(expression))return;await pause(150);}console.error(await browser.evaluate('({path:location.pathname,hash:location.hash,heading:document.querySelector("h1")?.innerText,tab:document.querySelector("[role=tab][aria-selected=true]")?.innerText})'));throw Error('Timeout: '+label);}
async function fill(name,value){await browser.evaluate(`(()=>{const e=document.querySelector('[name="${name}"]');Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);}
async function decision(value){await browser.evaluate(`(()=>{const e=document.querySelector('[name=decision]');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);await pause(100);}
try{
 await browser.start();await browser.navigate(base+'/login');await fill('email','admin@hatidone.test');await fill('password',accounts['admin@hatidone.test']);await browser.evaluate('document.querySelector("[name=password]").form.requestSubmit()');await wait('location.pathname==="/admin"','admin login');
 await browser.navigate(`${base}/admin/drivers/${driver.id}`);await wait('!!document.querySelector("[name=decision]")','review form');
 check(await browser.evaluate('document.querySelector("[name=decision]").value===""'),'Driver review requires an explicit decision');
 await decision('suspended');await fill('reason','Fictional QA review: temporarily suspend and restore this offline test driver.');needsRestore=true;
 await browser.evaluate('window.confirm=()=>true;document.querySelector("[name=decision]").form.requestSubmit()');await wait('location.search.includes("message=")','suspension save');
 check(await browser.evaluate(`location.pathname===${JSON.stringify('/admin/drivers/'+driver.id)}`),'Driver review save stays on the selected application');
 check((await admin.from('driver_profiles').select('verification_status,online').eq('id',driver.id).single()).data?.verification_status==='suspended','Suspension is persisted by the trusted review RPC');
 await browser.navigate(`${base}/admin/drivers/${driver.id}`);await wait('!!document.querySelector("option[value=verified]")','reinstatement option');await decision('verified');await fill('reason','Fictional QA complete: restore verified offline fixture.');
 await browser.evaluate('window.confirm=()=>true;document.querySelector("[name=decision]").form.requestSubmit()');await wait('location.search.includes("message=")','approval save');
 const restored=(await admin.from('driver_profiles').select('verification_status,online').eq('id',driver.id).single()).data;
 check(restored?.verification_status==='verified'&&restored.online===false,'Reviewed reinstatement restores verification and leaves the driver offline');needsRestore=false;await wait('document.querySelector(".notice-success")?.innerText.includes("Driver review saved")','review confirmation rendered');await pause(700);
 const before=(await admin.from('app_config').select('matching_weights').single()).data;
 await browser.navigate(base+'/admin/operations#system');await wait('document.querySelector("[role=tab][aria-selected=true]")?.innerText==="System"','system');
 await browser.evaluate('document.querySelector("[name=weight_idle]").disabled=true;document.querySelector("[name=default_matching_radius_km]").form.requestSubmit()');await wait('location.search.includes("error=")&&location.hash==="#system"','invalid configuration');
 check(JSON.stringify((await admin.from('app_config').select('matching_weights').single()).data)===JSON.stringify(before),'Incomplete configuration is rejected without changing matching weights');
 const ride=(await admin.from('ride_requests').select('id').eq('quote_status','pending_review').in('status',['requested','searching','offered']).limit(1).single()).data;
 if(!ride)throw Error('Pending-quote fixture required');
 await browser.navigate(`${base}/admin/dispatch?ride=${ride.id}&radius=10000`);await wait('!!document.querySelector(".dispatch-ride-selected")','selected dispatch ride');
 check(await browser.evaluate('document.querySelector(".dispatch-ride-selected button[type=submit]").disabled'),'Unreviewed quotes disable offer creation');
 // Existing seed rides are explicitly local-estimate demo fixtures. Use an absent
 // ride to test a real server error without asserting production policy on demo data.
 const missingRide='ffffffff-ffff-4fff-8fff-ffffffffffff';
 if((await admin.from('ride_requests').select('id',{count:'exact',head:true}).eq('id',missingRide)).count!==0)throw Error('Missing-ride fixture unexpectedly exists');
 await browser.evaluate(`document.querySelector('.dispatch-ride-selected [name=rideId]').value=${JSON.stringify(missingRide)};document.querySelector('.dispatch-ride-selected button[type=submit]').disabled=false;document.querySelector('.dispatch-ride-selected form').requestSubmit()`);await wait('location.search.includes("error=")','offer error');
 check(await browser.evaluate(`new URLSearchParams(location.search).get('ride')===${JSON.stringify(missingRide)}&&new URLSearchParams(location.search).get('radius')==='10000'`),'Missing ride error preserves requested ride and radius');
 await wait('document.body.innerText.includes("The selected ride is no longer")','missing ride notice');check(true,'Missing dispatch ride explains why it is absent from the queue');
 await browser.navigate(base+'/admin/drivers?page=9999');await wait('document.querySelector("h1")?.innerText==="Driver applications"','stale queue page');check(await browser.evaluate('document.body.innerText.includes("Showing the first page")'),'Stale queue page returns to the first page');
 for(const width of [360,1440]){await browser.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});for(const section of ['verification','safety','business','system']){await browser.navigate(base+'/admin/operations#'+section);await wait(`document.querySelector('[role=tabpanel]:not([hidden])')?.querySelector('h2')!=null`,'tab panel');await pause(200);check(await browser.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),`${section} tab has no overflow at ${width}px`);const shot=await browser.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(`docs/screenshots/admin/operations-${section}-${width}.png`,Buffer.from(shot.data,'base64'));}}
 await writeFile('docs/qa/admin-actions.json',JSON.stringify({checkedAt:new Date().toISOString(),environment:'disposable local backend',checks:results},null,2)+'\n');
 console.log(`Admin action checks passed: ${results.length}`);
}finally{
 if(needsRestore){const result=await admin.rpc('admin_review_driver',{p_driver_id:driver.id,p_decision:'verified',p_reason:'Restore fictional offline driver after interrupted QA.'});if(result.error)console.error('Fixture restoration requires inspection.');}
 await browser.stop();
}
