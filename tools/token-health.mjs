import { execFileSync } from 'node:child_process';
const base = 'https://graph.threads.net';
const token = process.env.THREADS_ACCESS_TOKEN;
const refreshDays = Number(process.env.REFRESH_AFTER_DAYS ?? 20);
const alarmDays = Number(process.env.ALARM_UNDER_DAYS ?? 14);
const repos = (process.env.TARGET_REPOS ?? '').split(/\s+/).filter(Boolean);
if (!token || !Number.isFinite(refreshDays) || refreshDays < 1 || refreshDays >= 60 || !Number.isFinite(alarmDays) || alarmDays < 1) throw new Error('Missing token or invalid health thresholds');
async function request(path, value, query = {}) {
  const url = new URL(path, base);
  for (const [key, val] of Object.entries(query)) url.searchParams.set(key, val);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${value}` }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`Token endpoint ${path} failed: HTTP ${res.status}`);
  return res.json(); // Never log response bodies: refresh bodies contain a credential.
}
if (!(await request('/v1.0/me', token, { fields: 'id' })).id) throw new Error('Token identity response missing id');
const debug = await request('/debug_token', token, { input_token: token });
const data = debug.data ?? debug;
const now = Date.now() / 1000;
if (data.is_valid !== true || !Number.isFinite(data.expires_at) || data.expires_at <= now) throw new Error('Token invalid or expiry unavailable; manual check required');
let left = (data.expires_at - now) / 86400;
// Prefer actual issue time. Long-lived tokens have a 60-day lifetime when issue time is absent.
const age = Number.isFinite(data.issued_at) && data.issued_at > 0 ? (now - data.issued_at) / 86400 : 60 - left;
console.log(`Token valid; ${left.toFixed(1)} days remain.`);
if (age >= refreshDays) {
  if (!process.env.GH_PAT) throw new Error('Token refresh is due but GH_PAT is missing; cannot store a replacement');
  if (repos.length !== 2 || !repos.every(repo => ['icehacer-sys/xray-cases', 'icehacer-sys/threads-bot'].includes(repo)) || new Set(repos).size !== 2) throw new Error('Unexpected token target repositories');
  const renewed = await request('/refresh_access_token', token, { grant_type: 'th_refresh_token', access_token: token });
  if (typeof renewed.access_token !== 'string' || !renewed.access_token || !Number.isFinite(renewed.expires_in) || renewed.expires_in < alarmDays * 86400) throw new Error('Refresh returned no usable token or insufficient lifetime');
  if (!(await request('/v1.0/me', renewed.access_token, { fields: 'id' })).id) throw new Error('Refreshed token identity response missing id');
  const failed = [];
  for (const repo of repos) {
    try {
      execFileSync('gh', ['secret', 'set', 'THREADS_ACCESS_TOKEN', '--repo', repo], { input: renewed.access_token, env: { ...process.env, GH_TOKEN: process.env.GH_PAT }, stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000 });
      console.log(`Updated token secret in ${repo}`);
    } catch { failed.push(repo); }
  }
  if (failed.length) throw new Error(`Token secret update failed for ${failed.join(', ')}; repositories may have different valid tokens`);
  left = renewed.expires_in / 86400;
}
if (left < alarmDays) throw new Error(`Only ${left.toFixed(1)} days remain before token expiry`);
console.log('Token health check passed.');
