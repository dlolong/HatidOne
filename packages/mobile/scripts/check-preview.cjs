const fs = require('node:fs');
const path = require('node:path');
const { publicHttps } = require('../src/public-url.cjs');
function validatePreview(env = process.env, profile = env.EAS_BUILD_PROFILE || 'preview') {
  const target = profile === 'production' ? 'production' : 'staging';
  if (env.EXPO_PUBLIC_APP_ENVIRONMENT !== target) throw new Error(`This ${profile} build requires EXPO_PUBLIC_APP_ENVIRONMENT=${target}.`);
  publicHttps(env.EXPO_PUBLIC_SUPABASE_URL, 'EXPO_PUBLIC_SUPABASE_URL');
  if (env.EXPO_PUBLIC_WEB_URL) publicHttps(env.EXPO_PUBLIC_WEB_URL, 'EXPO_PUBLIC_WEB_URL');
  const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!key || /YOUR_|PLACEHOLDER|sb_secret_/i.test(key)) throw new Error('Set EXPO_PUBLIC_SUPABASE_ANON_KEY to the selected backend public key.');
  if (key.split('.').length === 3) {
    let role;
    try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch { throw new Error('Malformed Supabase public key.'); }
    if (role !== 'anon') throw new Error('Only an anon or publishable key may be bundled.');
  } else if (!key.startsWith('sb_publishable_')) throw new Error('Use a Supabase anon or publishable key.');
  for (const name of Object.keys(env)) {
    if (name.startsWith('EXPO_PUBLIC_') && /SERVICE.?ROLE|SECRET|PRIVATE|PASSWORD|TOKEN/i.test(name)) throw new Error(`Privileged client variable prohibited: ${name}`);
    if (/MOCK|DEMO|PROVIDER/.test(name) && /^(true|1|mock|demo)$/i.test(env[name] || '')) throw new Error(`Disable simulated providers for release: ${name}`);
  }
}
module.exports = { validatePreview, publicHttps };
if (require.main === module) {
  try {
    for (const file of ['.env.local', '.env']) {
      if (fs.existsSync(path.resolve(file))) process.loadEnvFile(path.resolve(file));
    }
    validatePreview();
    console.log('PASS: preview public configuration. Backend deployment, isolation, signing and native build remain separate gates.');
  } catch (error) {
    console.error(`BLOCKED: ${error.message}`);
    process.exitCode = 1;
  }
}
