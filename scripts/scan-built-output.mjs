import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const roots = process.argv.slice(2);
if (!roots.length) roots.push('apps/web/.next/static');
let found = 0;
let files = 0;
let blocked = false;
function scan(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const target = join(path, entry.name);
    if (entry.isDirectory()) { scan(target); continue; }
    if (!/\.(js|json|html|map|bundle)$/.test(entry.name)) continue;
    files++;
    const content = readFileSync(target, 'utf8');
    let privileged = /sb_secret_[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content);
    for (const match of content.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
      try { if (JSON.parse(Buffer.from(match[1], 'base64url').toString()).role === 'service_role') privileged = true; } catch { /* Ignore non-JWT text. */ }
    }
    if (privileged) { found++; console.error(`FAIL privileged credential pattern in ${target} (value redacted)`); }
  }
}
for (const root of roots) {
  if (!existsSync(root)) { blocked = true; console.error(`BLOCKED build output absent: ${root}`); } else scan(root);
}
console.log(`${found ? 'FAIL' : blocked || !files ? 'BLOCKED' : 'PASS'} scanned ${files} client build files for privileged credential patterns; this is not a complete secret audit.`);
process.exitCode = found || blocked || !files ? 1 : 0;
