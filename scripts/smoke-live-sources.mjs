import process from "node:process";

const enabled = process.env.JHM_LIVE_SOURCE_SMOKE === "1";
const role = process.env.JHM_LIVE_SOURCE_ROLE || "Growth Marketing Manager";
const timeoutMs = Number(process.env.JHM_LIVE_SOURCE_TIMEOUT_MS || 25_000);

if (!enabled) {
  console.log("Live source smoke skipped. Set JHM_LIVE_SOURCE_SMOKE=1 to hit public job sources.");
  process.exit(0);
}

function fail(message) {
  throw new Error(message);
}

function withTimeout(promise, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return promise(controller.signal).finally(() => clearTimeout(timer)).catch((error) => {
    throw new Error(`${label} failed: ${error instanceof Error ? error.message : String(error)}`);
  });
}

async function getJson(url, label) {
  return withTimeout(async (signal) => {
    const response = await fetch(url, {
      signal,
      headers: {
        "User-Agent": "Juste Recrute Moi live-source-smoke",
        "Accept": "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  }, label);
}

function nonDemoUrl(value) {
  const text = String(value || "");
  return /^https?:\/\//i.test(text) && !/example\.com|jobs\.example|nimbusworks/i.test(text);
}

function requireAny(items, label, pickUrl) {
  if (!Array.isArray(items) || items.length === 0) {
    fail(`${label} returned no items`);
  }
  const usable = items.find((item) => nonDemoUrl(pickUrl(item)));
  if (!usable) {
    fail(`${label} returned no usable real URLs`);
  }
  return usable;
}

async function smokeRemoteOk() {
  const data = await getJson("https://remoteok.com/api", "RemoteOK");
  const rows = Array.isArray(data) ? data.filter((item) => item && typeof item === "object" && item.url) : [];
  const lead = requireAny(rows, "RemoteOK", (item) => item.url);
  return `RemoteOK: ${lead.company || "company"} - ${lead.position || lead.title || "role"}`;
}

async function smokeRemotive() {
  let data = await getJson(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(role)}`, "Remotive");
  let rows = Array.isArray(data?.jobs) ? data.jobs : [];
  if (rows.length === 0) {
    data = await getJson("https://remotive.com/api/remote-jobs", "Remotive fallback");
    rows = Array.isArray(data?.jobs) ? data.jobs : [];
  }
  const lead = requireAny(rows, "Remotive", (item) => item.url);
  return `Remotive: ${lead.company_name || "company"} - ${lead.title || "role"}`;
}

async function smokeJobicy() {
  let data = await getJson(`https://jobicy.com/api/v2/remote-jobs?count=20&tag=${encodeURIComponent(role)}`, "Jobicy");
  let rows = Array.isArray(data?.jobs) ? data.jobs : [];
  if (rows.length === 0) {
    data = await getJson("https://jobicy.com/api/v2/remote-jobs?count=20", "Jobicy fallback");
    rows = Array.isArray(data?.jobs) ? data.jobs : [];
  }
  const lead = requireAny(rows, "Jobicy", (item) => item.url || item.jobUrl);
  return `Jobicy: ${lead.companyName || lead.company || "company"} - ${lead.jobTitle || lead.title || "role"}`;
}

async function smokeHn() {
  const data = await getJson("https://hn.algolia.com/api/v1/search_by_date?tags=story&query=Ask%20HN%3A%20Who%20is%20hiring", "HN Algolia");
  const rows = Array.isArray(data?.hits) ? data.hits : [];
  const story = requireAny(rows, "HN Algolia", (item) => item.url || `https://news.ycombinator.com/item?id=${item.objectID || ""}`);
  return `HN Algolia: ${story.title || "Who is hiring thread"}`;
}

async function smokeOptionalAts() {
  const target = String(process.env.JHM_LIVE_ATS_TARGET || "").trim();
  if (!target) {
    return "ATS: skipped (set JHM_LIVE_ATS_TARGET=ats:greenhouse:slug, ats:lever:slug, or ats:ashby:slug)";
  }
  const [prefix, provider, slug] = target.split(":");
  if (prefix !== "ats" || !provider || !slug) {
    fail("JHM_LIVE_ATS_TARGET must look like ats:greenhouse:slug, ats:lever:slug, or ats:ashby:slug");
  }
  let url = "";
  if (provider === "greenhouse") url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`;
  if (provider === "lever") url = `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`;
  if (provider === "ashby") url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`;
  if (!url) fail(`Unsupported ATS provider for live smoke: ${provider}`);

  const data = await getJson(url, `ATS ${provider}`);
  const rows = Array.isArray(data?.jobs) ? data.jobs : Array.isArray(data) ? data : [];
  const lead = requireAny(rows, `ATS ${provider}`, (item) => item.absolute_url || item.hostedUrl || item.applyUrl || item.url);
  return `ATS ${provider}: ${lead.title || lead.text || "role"}`;
}

const checks = [smokeRemoteOk, smokeRemotive, smokeJobicy, smokeHn, smokeOptionalAts];
const results = [];

for (const check of checks) {
  results.push(await check());
}

console.log("Live source smoke passed:");
for (const line of results) {
  console.log(`- ${line}`);
}
