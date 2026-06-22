// Scheduled notifier — polls several public JSON APIs, filters by keyword, dedupes,
// and pushes brand-new items to Telegram. A practice project for fetch(), data
// normalization, and GitHub Actions cron. Zero dependencies (Node 20+ native fetch).

import { readFile, writeFile } from "node:fs/promises";
import { getSources, REMOTE_ONLY_SOURCES } from "./sources.mjs";

// ----- What counts as a match (tune freely) --------------------------------
const KEYWORDS = [
  "node", "node.js", "nodejs", "express", "nestjs",
  "react", "react native", "react.js",
  "next.js", "nextjs", "next js",
  "mern", "mongodb", "mongo",
  "full stack", "fullstack", "full-stack",
  "javascript", "typescript",
];
const BLOCKLIST = [
  "php developer", ".net", "salesforce", "wordpress", "magento",
  "unity", "game developer", "sales", "business development", "accountant",
];
const MAX_NOTIFY_PER_RUN = 15;

// Keep non-remote-board jobs only if they look remote / reachable from Pakistan.
// Set LOCATION_FILTER=off to disable.
const REMOTE_RE = /remote|anywhere|worldwide|distributed|global|pakistan|lahore|asia|emea|apac|hybrid/i;

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_CHAT_ID;
const SEEN_FILE = new URL("./seen.json", import.meta.url);

async function safe(label, fn) {
  try {
    const out = await fn();
    return Array.isArray(out) ? out : [];
  } catch (e) {
    console.error(`  [skip] ${label}: ${e.message}`);
    return [];
  }
}

function haystack(j) {
  return (j.title + " " + (j.tags || []).join(" ")).toLowerCase();
}
function matchesStack(j) {
  const h = haystack(j);
  if (BLOCKLIST.some((b) => h.includes(b))) return false;
  return KEYWORDS.some((k) => h.includes(k));
}
function keepLocation(j) {
  if (process.env.LOCATION_FILTER === "off") return true;
  if (REMOTE_ONLY_SOURCES.has(j.source)) return true;
  return REMOTE_RE.test(j.location || "") || REMOTE_RE.test(j.title || "");
}

// ----- Telegram ------------------------------------------------------------
const esc = (s) => String(s).replace(/[<&>]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
async function tg(text) {
  if (!TG_TOKEN || !TG_CHAT) {
    console.log("[telegram disabled] would send:\n" + text + "\n");
    return;
  }
  const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: "HTML", disable_web_page_preview: false }),
  });
  if (!r.ok) console.error("[telegram] send failed: " + (await r.text()));
}
const card = (j) =>
  `💼 <b>${esc(j.title)}</b>\n🏢 ${esc(j.company)}  •  📍 ${esc(j.location)}\n` +
  `🔗 <a href="${esc(j.url)}">Apply / view</a>  ·  <i>${esc(j.source)}</i>`;

// ----- Main ----------------------------------------------------------------
async function main() {
  let companies = {};
  try {
    companies = JSON.parse(await readFile(new URL("./companies.json", import.meta.url), "utf8"));
  } catch {}
  const cfg = {
    companies,
    adzuna: {
      id: process.env.ADZUNA_APP_ID,
      key: process.env.ADZUNA_APP_KEY,
      country: process.env.ADZUNA_COUNTRY || "gb",
    },
  };

  const sources = getSources(cfg);
  console.log(`Polling ${sources.length} sources…`);
  const results = await Promise.all(sources.map((s) => safe(s.label, s.fn)));

  const all = results.flat().filter((j) => j && j.id && j.url && j.title);
  const byId = new Map();
  for (const j of all) byId.set(j.id, j);

  const fresh = [...byId.values()].filter(matchesStack).filter(keepLocation);

  // per-source tally (helps you see which channels deliver)
  const tally = {};
  for (const j of fresh) tally[j.source] = (tally[j.source] || 0) + 1;
  console.log(`fetched=${all.length}  matched=${fresh.length}  by source:`, tally);

  let seen = { ids: [] };
  try {
    seen = JSON.parse(await readFile(SEEN_FILE, "utf8"));
  } catch {}
  const seenSet = new Set(seen.ids);
  const firstRun = seenSet.size === 0;
  const newJobs = fresh.filter((j) => !seenSet.has(j.id));
  console.log(`new=${newJobs.length}  firstRun=${firstRun}`);

  if (firstRun) {
    await tg(
      `✅ <b>Watcher is live.</b>\nMonitoring <b>${sources.length}</b> sources. ` +
        `Tracking <b>${fresh.length}</b> current matches — you'll get a ping the moment a new one appears.`
    );
  } else {
    for (const j of newJobs.slice(0, MAX_NOTIFY_PER_RUN)) {
      await tg(card(j));
      await new Promise((r) => setTimeout(r, 350));
    }
    if (newJobs.length > MAX_NOTIFY_PER_RUN)
      await tg(`…and <b>${newJobs.length - MAX_NOTIFY_PER_RUN}</b> more new matches this run.`);
  }

  const updated = [...seenSet, ...newJobs.map((j) => j.id)].slice(-8000);
  await writeFile(SEEN_FILE, JSON.stringify({ ids: updated }, null, 0) + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
