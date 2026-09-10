import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('./token-health.mjs', import.meta.url), 'utf8').replace("import { execFileSync } from 'node:child_process';", '');
const run = new (Object.getPrototypeOf(async function(){}).constructor)('process', 'fetch', 'execFileSync', 'console', source);
async function scenario({ days = 55, expiry = true, pat = true, failRepo = '', missingId = false } = {}) {
  const requests = [], secrets = [], logs = [];
  const env = { THREADS_ACCESS_TOKEN: 'fixture-old', GH_PAT: pat ? 'fixture-pat' : '', TARGET_REPOS: 'icehacer-sys/xray-cases icehacer-sys/threads-bot' };
  const fetch = async (url, opts) => {
    requests.push(url.pathname);
    let data;
    if (url.pathname === '/v1.0/me') data = missingId ? {} : { id: 'owner' };
    else if (url.pathname === '/debug_token') data = { data: { is_valid: true, ...(expiry ? { expires_at: Date.now()/1000 + days*86400 } : {}) } };
    else if (url.pathname === '/refresh_access_token') data = { access_token: 'fixture-new', expires_in: 60*86400 };
    else throw new Error('Unexpected endpoint');
    assert.ok(opts.headers.Authorization.startsWith('Bearer fixture-'));
    return { ok: true, json: async () => data };
  };
  const exec = (file, args, opts) => { assert.equal(file, 'gh'); assert.equal(opts.input, 'fixture-new'); secrets.push(args.at(-1)); if (args.at(-1) === failRepo) throw new Error('fixture secret failure'); };
  let error;
  try { await run({ env }, fetch, exec, { log: value => logs.push(value) }); } catch (e) { error = e; }
  assert.ok(!logs.join(' ').includes('fixture-'));
  return { requests, secrets, logs, error };
}
assert.equal((await scenario()).error, undefined);
assert.deepEqual((await scenario()).secrets, []);
const refreshed = await scenario({ days: 10 });
assert.equal(refreshed.error, undefined); assert.equal(refreshed.secrets.length, 2);
assert.match(String((await scenario({ expiry: false })).error), /expiry unavailable/);
assert.match(String((await scenario({ missingId: true })).error), /missing id/);
const noPat = await scenario({ days: 10, pat: false });
assert.match(String(noPat.error), /GH_PAT is missing/); assert.ok(!noPat.requests.includes('/refresh_access_token'));
const partial = await scenario({ days: 10, failRepo: 'icehacer-sys/threads-bot' });
assert.match(String(partial.error), /secret update failed/); assert.ok(!partial.logs.includes('Token health check passed.'));
console.log('PASS token freshness, renewal, missing expiry/identity, missing PAT, and partial secret failure with no network or secret writes');
