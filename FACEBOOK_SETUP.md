# Facebook auto-posting setup

The poster cross-posts each daily X-ray **challenge photo** to the Facebook Page
**Weird X-Ray Case Files** (best-effort — Threads always posts even if Facebook fails).

To turn it on you need two values:

- `FB_PAGE_ID` — the Page's numeric id
- `FB_PAGE_ACCESS_TOKEN` — a **long-lived** Page access token

Everything below is a one-time setup. Posting to a Page **you** admin does **not** require Meta App Review.

---

## 1. Create a Meta app
1. Go to <https://developers.facebook.com/apps> → **Create app**.
2. Choose type **Business**. Name it anything (e.g. `xray-poster`).
3. Note your **App ID** and **App Secret** (Settings → Basic).

## 2. Generate a User token with Page permissions
1. Open the **Graph API Explorer**: <https://developers.facebook.com/tools/explorer>
2. Top-right: select your app.
3. Click **Generate access token** and grant these three permissions:
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`

   This is a **short-lived** user token (~1 hour) — fine, we upgrade it next.

## 3. Find your Page ID + Page token
In the Explorer, run:

```
GET /me/accounts
```

Find **Weird X-Ray Case Files** in the response:
- `id` → this is your **FB_PAGE_ID**
- `access_token` → a Page token (still short-lived here)

## 4. Make the token long-lived (important — short tokens die in an hour)

**a)** Exchange the user token for a long-lived one (~60 days):

```
GET https://graph.facebook.com/v21.0/oauth/access_token
    ?grant_type=fb_exchange_token
    &client_id=APP_ID
    &client_secret=APP_SECRET
    &fb_exchange_token=SHORT_USER_TOKEN
```

**b)** With that **long-lived user token**, run `GET /me/accounts` again. The Page
`access_token` you get **now** is a **long-lived Page token** — Page tokens derived from a
long-lived user token don't expire as long as you stay an admin and keep the permissions.
That value is your **FB_PAGE_ACCESS_TOKEN**.

> For a *never*-expiring token, create a **System User** in Meta Business Settings, assign
> the Page, and generate a token there. Optional — the step-4b token is enough to start.

## 5. Plug it in and verify

**Local** — add to `xray-poster/.env`:

```
FB_PAGE_ID=1234567890
FB_PAGE_ACCESS_TOKEN=EAAG...
BOT_FACEBOOK=on
```

Verify the token is valid (read-only, posts nothing):

```
npx tsx src/fbverify.ts
```

You should see: `FB token OK -> Page "Weird X-Ray Case Files" ...`

**Cloud (GitHub Actions)** — add two repository secrets under
Settings → Secrets and variables → Actions:
- `FB_PAGE_ID`
- `FB_PAGE_ACCESS_TOKEN`

Then edit `.github/workflows/publish.yml` and set `BOT_FACEBOOK: "on"`.

---

## Notes
- The image URL must be public. The poster already uses your `GITHUB_RAW_BASE` raw-GitHub
  URLs, which Meta can fetch — no change needed.
- If a token ever stops working, repeat **step 4** to mint a fresh long-lived Page token.
- v1 posts the **challenge photo + caption** only. Cross-posting the answer/CTA and building
  Reels can come next.
