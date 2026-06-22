// Data sources for the scheduled notifier. Each returns normalized items:
//   { id, title, company, location, tags:[], url, source }
// Defensive: a failing source returns [] and never kills the run.
// (Endpoint URLs are the actual fetch targets and can't be obscured.)

const UA = { "User-Agent": "practice-app/2.0 (personal project)", Accept: "application/json" };

async function getJSON(url, opts = {}) {
  const r = await fetch(url, { headers: UA, ...opts });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}
async function getText(url, opts = {}) {
  const r = await fetch(url, { headers: { ...UA, Accept: "*/*" }, ...opts });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.text();
}
const strip = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();

// ---------- F1 ----------
export async function f1() {
  const data = await getJSON("https://remoteok.com/api");
  return data
    .filter((j) => j && j.id && j.position)
    .map((j) => ({
      id: "f1:" + j.id,
      title: j.position,
      company: j.company || "—",
      location: j.location || "Remote",
      tags: j.tags || [],
      url: j.url || `https://remoteok.com/remote-jobs/${j.id}`,
      source: "F1",
    }));
}

// ---------- F2 ----------
export async function f2() {
  const { jobs = [] } = await getJSON("https://remotive.com/api/remote-jobs?limit=150");
  return jobs.map((j) => ({
    id: "f2:" + j.id,
    title: j.title,
    company: j.company_name || "—",
    location: j.candidate_required_location || "Remote",
    tags: j.tags || [],
    url: j.url,
    source: "F2",
  }));
}

// ---------- F3 ----------
export async function f3() {
  const { jobs = [] } = await getJSON("https://himalayas.app/jobs/api?limit=150");
  return jobs.map((j) => ({
    id: "f3:" + (j.guid || j.applicationLink || j.title),
    title: j.title,
    company: j.companyName || j.company || "—",
    location: (j.locationRestrictions && j.locationRestrictions.join(", ")) || "Remote",
    tags: j.categories || [],
    url: j.applicationLink || j.url,
    source: "F3",
  }));
}

// ---------- F4 ----------
export async function f4() {
  const { jobs = [] } = await getJSON("https://jobicy.com/api/v2/remote-jobs?count=100");
  return jobs.map((j) => ({
    id: "f4:" + j.id,
    title: j.jobTitle,
    company: j.companyName || "—",
    location: j.jobGeo || "Remote",
    tags: [].concat(j.jobIndustry || [], j.jobType || []),
    url: j.url,
    source: "F4",
  }));
}

// ---------- F5 ----------
export async function f5() {
  const feeds = [
    "https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss",
    "https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss",
    "https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss",
  ];
  const out = [];
  for (const f of feeds) {
    const xml = await getText(f).catch(() => "");
    for (const item of xml.split("<item>").slice(1)) {
      const title = strip((item.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
      const link = strip((item.match(/<link>([\s\S]*?)<\/link>/) || [])[1]);
      const region = strip((item.match(/<region>([\s\S]*?)<\/region>/) || [])[1]);
      if (!title || !link) continue;
      const [company, ...rest] = title.split(":");
      out.push({
        id: "f5:" + link,
        title: rest.join(":").trim() || title,
        company: rest.length ? company.trim() : "—",
        location: region || "Remote",
        tags: [],
        url: link,
        source: "F5",
      });
    }
  }
  return out;
}

// ---------- F6 ----------
export async function f6() {
  const out = [];
  for (const page of [0, 1]) {
    const { results = [] } = await getJSON(
      `https://www.themuse.com/api/public/jobs?category=Software%20Engineering&page=${page}`
    ).catch(() => ({ results: [] }));
    for (const j of results) {
      out.push({
        id: "f6:" + j.id,
        title: j.name,
        company: (j.company && j.company.name) || "—",
        location: (j.locations && j.locations.map((l) => l.name).join(", ")) || "—",
        tags: (j.tags || []).map((t) => t.name || t),
        url: j.refs && j.refs.landing_page,
        source: "F6",
      });
    }
  }
  return out;
}

// ---------- F7 (monthly community thread) ----------
export async function f7() {
  const search = await getJSON(
    "https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&query=who%20is%20hiring&hitsPerPage=5"
  );
  const thread = (search.hits || []).find((h) => /who is hiring/i.test(h.title || ""));
  if (!thread) return [];
  const comments = await getJSON(
    `https://hn.algolia.com/api/v1/search?tags=comment,story_${thread.objectID}&hitsPerPage=200`
  );
  return (comments.hits || [])
    .filter((c) => c.comment_text)
    .map((c) => {
      const text = strip(c.comment_text);
      return {
        id: "f7:" + c.objectID,
        title: text.slice(0, 90),
        company: "—",
        location: /remote/i.test(text) ? "Remote (per post)" : "—",
        tags: [text], // fold body in so keyword matching works
        url: `https://news.ycombinator.com/item?id=${c.objectID}`,
        source: "F7",
      };
    });
}

// ---------- F8 ----------
export async function f8() {
  const { data = [] } = await getJSON("https://www.arbeitnow.com/api/job-board-api");
  return data.map((j) => ({
    id: "f8:" + (j.slug || j.url),
    title: j.title,
    company: j.company_name || "—",
    location: j.remote ? "Remote" : j.location || "—",
    tags: j.tags || [],
    url: j.url,
    source: "F8",
  }));
}

// ---------- Group A (per-slug) ----------
export async function ga(slug) {
  const { jobs = [] } = await getJSON(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`);
  return jobs.map((j) => ({
    id: "a:" + slug + ":" + j.id,
    title: j.title,
    company: slug,
    location: (j.location && j.location.name) || "—",
    tags: [],
    url: j.absolute_url,
    source: "A",
  }));
}

// ---------- Group B (per-slug) ----------
export async function gb(slug) {
  const data = await getJSON(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  return (Array.isArray(data) ? data : []).map((j) => ({
    id: "b:" + slug + ":" + j.id,
    title: j.text,
    company: slug,
    location: (j.categories && j.categories.location) || "—",
    tags: [j.categories && j.categories.team, j.categories && j.categories.commitment].filter(Boolean),
    url: j.hostedUrl,
    source: "B",
  }));
}

// ---------- Group C (per-slug) ----------
export async function gc(slug) {
  const data = await getJSON(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
  const jobs = data.jobs || [];
  return jobs.map((j) => ({
    id: "c:" + slug + ":" + (j.id || j.title),
    title: j.title,
    company: slug,
    location: j.location || (j.address && j.address.postalAddress && j.address.postalAddress.addressLocality) || "Remote",
    tags: [j.team, j.employmentType].filter(Boolean),
    url: j.jobUrl || j.applyUrl,
    source: "C",
  }));
}

// ---------- F9 (optional, needs keys) ----------
export async function f9({ id, key, country = "gb" }) {
  const out = [];
  for (const what of ["node.js developer", "react developer", "full stack developer"]) {
    const url =
      `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${id}&app_key=${key}` +
      `&results_per_page=50&what=${encodeURIComponent(what)}&content-type=application/json`;
    const { results = [] } = await getJSON(url).catch(() => ({ results: [] }));
    for (const j of results) {
      out.push({
        id: "f9:" + j.id,
        title: j.title,
        company: (j.company && j.company.display_name) || "—",
        location: (j.location && j.location.display_name) || "—",
        tags: [j.category && j.category.label].filter(Boolean),
        url: j.redirect_url,
        source: "F9",
      });
    }
  }
  return out;
}

// ---------- Assemble active sources from config ----------
export function getSources(cfg) {
  const s = [
    { label: "F1", fn: f1 },
    { label: "F2", fn: f2 },
    { label: "F3", fn: f3 },
    { label: "F4", fn: f4 },
    { label: "F5", fn: f5 },
    { label: "F6", fn: f6 },
    { label: "F7", fn: f7 },
    { label: "F8", fn: f8 },
  ];
  const c = cfg.companies || {};
  for (const slug of c.groupA || []) s.push({ label: `A:${slug}`, fn: () => ga(slug) });
  for (const slug of c.groupB || []) s.push({ label: `B:${slug}`, fn: () => gb(slug) });
  for (const slug of c.groupC || []) s.push({ label: `C:${slug}`, fn: () => gc(slug) });
  if (cfg.adzuna && cfg.adzuna.id && cfg.adzuna.key)
    s.push({ label: "F9", fn: () => f9(cfg.adzuna) });
  return s;
}

// sources that are inherently remote-only (skip location filtering for these)
export const REMOTE_ONLY_SOURCES = new Set(["F1", "F2", "F3", "F4", "F5"]);
