---
name: blog-automation
description: Architecture and hard-won gotchas for this repo's auto-updating blog posts (latest-gadgets, trending-products, trending-products-amazon) — GitHub Actions scheduled scripts that hit Amazon/Rakuten/Gemini APIs. Use when debugging one of these workflows, adding a new automated content pipeline, or hitting a weird 403/429/503 from these APIs.
---

# Blog content automation

This repo (`ikeponsu.github.io`, Next.js static export → GitHub Pages) has three
self-updating blog posts, each driven by a Node script + a scheduled GitHub
Actions workflow that overwrites one Markdown file and commits it:

| Post slug | Script | Workflow | Schedule | Data source |
| --- | --- | --- | --- | --- |
| `latest-gadgets` | `scripts/fetch-latest-gadgets.mjs` | `update-gadgets.yml` | 9:00/12:00/18:00 JST | Amazon Creators API (keyword: ガジェット) |
| `trending-products` | `scripts/fetch-trending-products.mjs` | `update-trending.yml` | every 2h | Google Trends RSS + Rakuten Ichiba |
| `trending-products-amazon` | `scripts/fetch-trending-products-amazon.mjs` | `update-trending-amazon.yml` | every 2h | Google Trends RSS + Amazon Creators API |

All three follow the same shape: fetch candidates → filter/search per item →
optionally ask Gemini for a short blurb (skippable, never blocks the pipeline) →
write one Markdown file → workflow commits it if changed → deploy triggers.

## Gotcha 1: GITHUB_TOKEN pushes do not fire `on: push`

A workflow that pushes with the default `GITHUB_TOKEN` will **not** trigger another
workflow's `push` event (GitHub's loop-prevention). That's why `deploy.yml` needs an
explicit `workflow_run` trigger listing every content-update workflow by name:

```yaml
on:
  push:
    branches: ["main"]
  workflow_run:
    workflows: ["Update Latest Gadgets", "Update Trending Products", "Update Trending Products (Amazon)"]
    types: [completed]
    branches: ["main"]
jobs:
  build:
    if: github.event_name != 'workflow_run' || github.event.workflow_run.conclusion == 'success'
```

Any new auto-commit workflow **must** be added to that `workflows:` list (exact
`name:` string match) or its commits will silently never deploy.

## Gotcha 2: `fetch()` silently drops the `Referer` header

Node's built-in `fetch` (undici) treats `Referer` as a WHATWG "forbidden header"
and drops it without error — the request goes out, just without that header. If an
API requires `Referer` (Rakuten's new Ichiba API does, and checks `Origin` too),
use `node:https` directly instead:

```js
import https from "node:https";
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: "GET", headers }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () =>
        resolve({ status: res.statusCode, ok: res.statusCode < 300, text: Buffer.concat(chunks).toString("utf8") }),
      );
    });
    req.on("error", reject);
    req.end();
  });
}
```

Symptom to watch for: the server insists a header is "missing" even though your
code clearly sets it — check whether you're using `fetch()` before assuming the
server-side docs are wrong.

## Gotcha 3: these third-party APIs churn fast — verify, don't assume "maintenance"

Encountered in this repo, within one summer:

- **Amazon PA-API 5.0** fully shut down 2026-05 → replaced by **Creators API**
  (OAuth2 client_credentials, not AWS SigV4; lowerCamelCase fields; resource enum
  changed, e.g. `offers.listings.price` → `offersV2.listings.price`).
- **Rakuten Ichiba Item Search** old version (`.../Search/20170706`) returned
  `HTTP 503 {"error":"service_unavailable"}` — looked like transient maintenance,
  was actually a sunset in progress. New version (`openapi.rakuten.co.jp/.../Search/20260701`)
  requires a new `accessKey` credential (issued via a fresh app registration,
  `pk_...`), plus `Referer` **and** `Origin` headers matching the app's registered
  "Allowed websites" domain (see Gotcha 2 for why `fetch()` can't send `Referer`).
- **GitHub Models** (the free `GITHUB_TOKEN`-based inference API) retired entirely
  2026-07-30 — not usable as a free Gemini/GPT proxy from Actions anymore.
- **Gemini model IDs** rotate every few months (`gemini-2.0-flash-lite` → dead
  2026-06 → currently `gemini-3.5-flash-lite`). Don't trust a hardcoded model name
  from memory; check `ai.google.dev/gemini-api/docs/models` if calls start 404ing.

Lesson: when an external API returns an error that superficially looks transient
("maintenance", generic 403/503), search for recent deprecation/migration
announcements before writing retry logic — retries won't fix a sunset endpoint.

## Gotcha 4: rate limits need a delay before *every* attempt, not just after success

An early bug: `await sleep(...)` was placed only after a successful push into the
results array, so failed attempts (which are common — most trending keywords don't
match a product) retried with zero delay and cascaded into `429 Rate limit
exceeded`. Sleep before each request attempt, unconditionally, e.g.:

```js
for (const trend of trends) {
  await sleep(1200); // before every attempt, success or failure
  const item = await searchItem(trend);
  ...
}
```

## Gotcha 5: fail fast on systemic errors instead of retrying every item

If the first API call in a loop fails with a "the whole service is down" signal
(e.g. Rakuten's `service_unavailable`), don't burn through the remaining 9 items
with the same doomed request — throw a distinguishable error class and abort the
run immediately. The cron will just try again next cycle.

## Operational notes

- **Never** paste real API key values into chat, code, or commits — only into
  GitHub Secrets. If a key is exposed (even in this conversation), treat it as
  compromised and rotate it at the source (Google AI Studio, Amazon Associates
  Central, Rakuten Web Service, etc.).
- Test any new/changed pipeline with the workflow's `workflow_dispatch` button
  before trusting the cron schedule — it's the fastest feedback loop and the logs
  show the raw upstream error body.
- Each pipeline writes to a single fixed-slug Markdown file that gets overwritten
  every run (not accumulated as separate posts per run) — this was a deliberate
  choice to avoid unbounded post growth.
- Gemini calls are always optional/best-effort: if `GEMINI_API_KEY` is unset or the
  call fails, the pipeline still produces a post, just without the AI blurb.
