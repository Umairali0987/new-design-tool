# new-design-tool

A personal sandbox for practicing modern JavaScript and automation:

- **Node.js** scripting with native `fetch` (zero dependencies)
- **GitHub Actions** for CI/CD and scheduled (cron) workflows
- **Telegram Bot API** for push notifications

The script polls a few public JSON APIs on a schedule, normalizes and de-duplicates the
data, and sends me a Telegram message when something new shows up — mostly an exercise in
`fetch()`, data wrangling, and running jobs on Actions cron.

## Stack
Node 20 · GitHub Actions · Telegram Bot API

---

## Setup

### 1. Telegram bot (notifications channel)
1. In Telegram, open **@BotFather** → `/newbot` → copy the **token**.
2. Message your new bot "hi", then open `https://api.telegram.org/bot<TOKEN>/getUpdates`
   and copy the `chat.id`.

### 2. Push to GitHub (public)
```bash
cd job-alert-bot
git remote add origin https://github.com/M-Ahmad-Saleem/new-design-tool.git
git push -u origin main
```

### 3. Add secrets
repo → **Settings → Secrets and variables → Actions → New repository secret**:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

### 4. Permissions
**Settings → Actions → General → Workflow permissions → "Read and write"**
(lets the workflow save its small state file between runs).

### 5. Run
**Actions** tab → run the workflow. It sends a "live" message, then notifies on anything new.
The schedule is every 10 min (see `.github/workflows/*.yml`) — change the cron to taste.

---

## Configuring
- `fetch.mjs` — the `KEYWORDS` / `BLOCKLIST` arrays control what counts as a match.
- `sources.mjs` — the list of public APIs polled (add/remove here).
- `companies.json` — extra company API boards to include.
- Optional: set `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` secrets to pull from Adzuna too.
- Optional: set `RAPIDAPI_KEY` secret to enable F10 (JSearch — LinkedIn/Indeed/Glassdoor via
  Google for Jobs). Throttled to 2 slots/day (06:0x & 18:0x UTC) to respect the free tier.

## Test locally
```bash
TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_ID=yyy node fetch.mjs
# leave the env vars off and it just prints what it WOULD send
```
