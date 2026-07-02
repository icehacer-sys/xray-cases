// Read-only check that FB_PAGE_ID + FB_PAGE_ACCESS_TOKEN are valid. Posts NOTHING —
// it just GETs the Page name + follower count so you can confirm the token works before
// flipping BOT_FACEBOOK on. Run from xray-poster root: npx tsx src/fbverify.ts
import { config, requireEnv } from "./config.js";

const pageId = requireEnv("FB_PAGE_ID");
const token = requireEnv("FB_PAGE_ACCESS_TOKEN");
const url = `${config.fbBase}/${pageId}?fields=name,followers_count,fan_count&access_token=${encodeURIComponent(token)}`;

const res = await fetch(url);
const body: any = await res.json().catch(() => ({}));

if (!res.ok || body?.error) {
  console.error(`FB check FAILED (${res.status}): ${body?.error?.message ?? JSON.stringify(body)}`);
  process.exit(1);
}

const followers = body.followers_count ?? body.fan_count ?? "?";
console.log(`FB token OK -> Page "${body.name}" (id ${pageId}), followers: ${followers}`);
