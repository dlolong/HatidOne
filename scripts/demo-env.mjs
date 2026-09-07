import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const result=spawnSync(process.execPath,[resolve(root,'scripts/backend.mjs'),'status','--json'],{cwd:root,encoding:'utf8'});
if(result.status!==0)throw new Error('Start the local backend with npm run backend:start first.');
const start=result.stdout.indexOf('{');
const status=JSON.parse(result.stdout.slice(start));
const url=status.API_URL;const key=status.ANON_KEY;
if(typeof url!=='string'||typeof key!=='string'||!/^http:\/\/(127\.0\.0\.1|localhost):55321$/.test(url))throw new Error('Expected the isolated HatidOne local backend.');
const files={
 'apps/web/.env.local':`NEXT_PUBLIC_SUPABASE_URL=${url}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${key}\nNEXT_PUBLIC_SITE_URL=http://localhost:3003\nHATIDONE_DEMO_MODE=true\n`,
 'apps/passenger-mobile/.env':`EXPO_PUBLIC_SUPABASE_URL=${url}\nEXPO_PUBLIC_SUPABASE_ANON_KEY=${key}\nEXPO_PUBLIC_DEMO_MODE=true\n`,
 'apps/driver-mobile/.env':`EXPO_PUBLIC_SUPABASE_URL=${url}\nEXPO_PUBLIC_SUPABASE_ANON_KEY=${key}\nEXPO_PUBLIC_WEB_URL=http://localhost:3003\n`,
};
for(const [name,contents]of Object.entries(files)){const path=resolve(root,name);if(existsSync(path)){console.log(`Kept existing ${name}; update its public configuration manually if needed.`);continue;}writeFileSync(path,contents,{mode:0o600});console.log(`Created ${name} with public local configuration only.`);}
