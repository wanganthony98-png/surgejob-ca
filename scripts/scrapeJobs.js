/**
 * Daily Apify → Supabase pipeline.
 * Required env: APIFY_API_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { ApifyClient } = require("apify-client");
const { createClient } = require("@supabase/supabase-js");

const APIFY_ACTOR = process.env.APIFY_ACTOR || "scrapeify/google-news-scraper";
const NEWS_QUERY =
  process.env.APIFY_NEWS_QUERY ||
  'Canada ("startup" OR "start-up") (funding OR "raises" OR "Series A" OR "Series B" OR hiring OR "is hiring") (tech OR AI OR SaaS)';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const raw of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value.startsWith("[") && value.endsWith("]")) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, "..", ".env.local"));

function missingEnv(name) {
  const value = process.env[name];
  return !value || !String(value).trim();
}

if (missingEnv("APIFY_API_TOKEN")) {
  console.error(
    "Missing APIFY_API_TOKEN. Add it as a GitHub Actions secret (or to .env.local for local runs) and re-run the scraper.",
  );
  process.exit(1);
}

if (missingEnv("SUPABASE_SERVICE_ROLE_KEY")) {
  console.error(
    "Missing SUPABASE_SERVICE_ROLE_KEY. Add it as a GitHub Actions secret (or to .env.local for local runs) and re-run the scraper.",
  );
  process.exit(1);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function clamp(n, min = 35, max = 96) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function slugId(name) {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 64);
  return slug || `company-${Date.now()}`;
}

function uuidFromSlug(slug) {
  const bytes = Buffer.from(crypto.createHash("sha1").update(`surgejob-company:${slug}`).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function initials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "SJ";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function articleText(item) {
  return [
    item.title,
    item.headline,
    item.description,
    item.snippet,
    item.summary,
    item.link,
    item.url,
    item.source,
    item.publisher,
  ]
    .filter(Boolean)
    .join(" ");
}

const GENERIC_NAMES = new Set([
  "canada",
  "canadian",
  "toronto",
  "montreal",
  "vancouver",
  "ottawa",
  "startup",
  "startups",
  "tech",
  "ai",
  "saas",
  "news",
  "report",
  "google",
  "microsoft",
  "amazon",
  "apple",
]);

function extractCompanyName(item) {
  const title = String(item.title || item.headline || "").trim();
  const patterns = [
    /^([A-Z][\w.&'-]+(?:\s+[A-Z][\w.&'-]+){0,4})\s+(?:raises|raised|closes|closed|secures|secured|lands|announces|is hiring|hires|hired|expands|launches)/,
    /(?:at|from)\s+([A-Z][\w.&'-]+(?:\s+[A-Z][\w.&'-]+){0,3})/,
  ];
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match?.[1] && !GENERIC_NAMES.has(match[1].toLowerCase())) {
      return match[1].replace(/[,:].*$/, "").trim();
    }
  }
  const leading = title.split(/[:–—|-]/)[0]?.trim();
  if (leading && leading.length < 48 && /^[A-Z]/.test(leading) && !GENERIC_NAMES.has(leading.toLowerCase())) {
    return leading;
  }
  return null;
}

function extractFunding(text) {
  const roundMatch = text.match(/\b(pre-seed|seed|series\s+[a-d])\b/i);
  const amountMatch = text.match(/\$([\d.]+)\s*(billion|bn|million|m|k)?\b/i);
  let fundingAmount = null;
  if (amountMatch) {
    const n = amountMatch[1];
    const unit = (amountMatch[2] || "m").toLowerCase();
    const suffix = unit.startsWith("b") ? "B" : unit === "k" ? "K" : "M";
    fundingAmount = `$${n}${suffix} CAD`;
  }
  const fundingRound = roundMatch
    ? roundMatch[1].replace(/\b\w/g, (c) => c.toUpperCase()).replace(/Series\s+/i, "Series ")
    : amountMatch
      ? "Seed"
      : "Seed";
  return { fundingRound, fundingAmount };
}

function extractLocation(text) {
  const cities = [
    ["Toronto", "Toronto, ON"],
    ["Montreal", "Montreal, QC"],
    ["Vancouver", "Vancouver, BC"],
    ["Waterloo", "Waterloo, ON"],
    ["Ottawa", "Ottawa, ON"],
    ["Calgary", "Calgary, AB"],
    ["Kitchener", "Kitchener, ON"],
  ];
  for (const [needle, label] of cities) {
    if (new RegExp(`\\b${needle}\\b`, "i").test(text)) return label;
  }
  return "Canada";
}

function extractIndustry(text) {
  const lower = text.toLowerCase();
  if (/\b(fintech|payments|bank|ledger)\b/.test(lower)) return "Fintech";
  if (/\b(ai|machine learning|data)\b/.test(lower)) return "AI & Data";
  if (/\b(climate|cleantech|energy|grid)\b/.test(lower)) return "CleanTech & Energy";
  if (/\b(privacy|security|cyber)\b/.test(lower)) return "Privacy & Security";
  if (/\b(saas|b2b|software)\b/.test(lower)) return "B2B SaaS";
  return "B2B SaaS";
}

function scoreAxis(text, keywords, base) {
  const lower = text.toLowerCase();
  const hits = keywords.reduce((sum, word) => sum + (lower.includes(word) ? 1 : 0), 0);
  return clamp(base + hits * 7);
}

function buildSurgeIndex(text) {
  const growth = scoreAxis(text, ["hiring", "hire", "headcount", "expand", "growth", "jobs"], 58);
  const product = scoreAxis(text, ["product", "launch", "platform", "ai", "saas", "app"], 56);
  const market = scoreAxis(text, ["canada", "toronto", "customer", "market", "enterprise"], 60);
  const leadership = scoreAxis(text, ["ceo", "founder", "appoint", "leadership", "cto"], 54);
  const culture = scoreAxis(text, ["culture", "remote", "hybrid", "workplace", "talent"], 52);
  const capital = scoreAxis(text, ["raise", "funding", "series", "seed", "venture", "million", "investor"], 62);
  const radar = { growth, product, market, leadership, culture, capital };
  const score = Math.round(
    (growth + product + market + leadership + culture + capital) / 6,
  );
  return { radar, score };
}

function markColor(name) {
  const palette = ["#0f766e", "#1d4ed8", "#7c3aed", "#c2410c", "#334155", "#be123c"];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i) * (i + 1)) % palette.length;
  return palette[hash];
}

function toCompanyRow(item, scrapedAt) {
  const name = extractCompanyName(item);
  if (!name) return null;
  const text = articleText(item);
  const { fundingRound, fundingAmount } = extractFunding(text);
  const location = extractLocation(text);
  const { radar, score } = buildSurgeIndex(text);
  const hiring = /\b(hir(e|ing|es)|jobs?|roles?)\b/i.test(text);
  const sourceUrl = item.link || item.url || item.articleUrl || null;
  const mission = String(item.description || item.snippet || item.title || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);

  return {
    id: uuidFromSlug(slugId(name)),
    name,
    mark: initials(name),
    mark_color: markColor(name),
    industry: extractIndustry(text),
    mission: mission || `Canadian tech company surfaced from recent funding/hiring coverage.`,
    funding_round: fundingRound,
    funding_amount: fundingAmount,
    funding_date: scrapedAt.slice(0, 10),
    funded_relative: "Scraped in the latest daily run",
    lead_investor: null,
    headcount: "11-50",
    headcount_label: "11-50 employees",
    location,
    work_arrangement: "hybrid",
    glassdoor_rating: null,
    open_role_count: hiring ? 1 : 0,
    evidence_completeness: "incomplete",
    surge_index: score,
    surge_radar: radar,
    source_url: sourceUrl,
    scraped_at: scrapedAt,
  };
}

function dedupeCompanies(rows) {
  const byId = new Map();
  for (const row of rows) {
    const existing = byId.get(row.id);
    if (!existing) {
      byId.set(row.id, row);
      continue;
    }
    const merged = { ...existing, ...row };
    merged.surge_radar = {
      growth: Math.max(existing.surge_radar.growth, row.surge_radar.growth),
      product: Math.max(existing.surge_radar.product, row.surge_radar.product),
      market: Math.max(existing.surge_radar.market, row.surge_radar.market),
      leadership: Math.max(existing.surge_radar.leadership, row.surge_radar.leadership),
      culture: Math.max(existing.surge_radar.culture, row.surge_radar.culture),
      capital: Math.max(existing.surge_radar.capital, row.surge_radar.capital),
    };
    merged.surge_index = Math.round(
      Object.values(merged.surge_radar).reduce((sum, value) => sum + value, 0) / 6,
    );
    merged.open_role_count = Math.max(existing.open_role_count, row.open_role_count);
    byId.set(row.id, merged);
  }
  return [...byId.values()];
}

function actorInput(actorId, maxItems) {
  if (actorId.includes("scrapeify/google-news-scraper")) {
    return { keyword: NEWS_QUERY, query: NEWS_QUERY, numberOfResults: maxItems, maxResults: maxItems };
  }
  if (actorId.includes("xmolodtsov/google-news-scraper")) {
    return {
      query: NEWS_QUERY,
      region: "CA",
      language: "en-CA",
      maxItems,
      maxItemsPerUrl: maxItems,
      fetchArticleDetails: false,
    };
  }
  return {
    query: NEWS_QUERY,
    language: "CA:en",
    maxItems,
    fetchArticleDetails: false,
    proxyConfiguration: { useApifyProxy: true },
  };
}

async function fetchNews(token) {
  const client = new ApifyClient({ token });
  const maxItems = Number(process.env.APIFY_MAX_ITEMS || 40);
  const candidates = [
    APIFY_ACTOR,
    "scrapeify/google-news-scraper",
    "xmolodtsov/google-news-scraper",
  ].filter((id, index, list) => list.indexOf(id) === index);

  let lastError = null;
  for (const actorId of candidates) {
    try {
      console.log(`Fetching Canadian tech funding/hiring news via ${actorId}…`);
      const run = await client.actor(actorId).call(actorInput(actorId, maxItems), { waitSecs: 180 });
      if (!run?.defaultDatasetId) {
        throw new Error("Apify run finished without a dataset id.");
      }
      const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 100 });
      return items || [];
    } catch (error) {
      lastError = error;
      const message = error?.message || String(error);
      if (/rent a paid Actor|free trial has expired/i.test(message)) {
        console.warn(`${actorId} is paid-only; trying the next free actor.`);
        continue;
      }
      throw error;
    }
  }
  throw lastError || new Error("No available Apify news actor could be run.");
}

async function upsertCompanies(supabase, rows) {
  let payload = rows;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { error } = await supabase.from("companies").upsert(payload, { onConflict: "id" });
    if (!error) return;
    const missing = error.message?.match(/Could not find the '([^']+)' column/i);
    if (missing?.[1]) {
      const column = missing[1];
      console.warn(`Dropping unsupported column "${column}" and retrying upsert.`);
      payload = payload.map((row) => {
        const next = { ...row };
        if (column === "surge_radar" && row.surge_radar) {
          next.mission = `${row.mission} Surge radar ${JSON.stringify(row.surge_radar)}`.slice(0, 500);
        }
        delete next[column];
        return next;
      });
      continue;
    }
    if (/on conflict|unique|no unique or exclusion constraint/i.test(error.message || "")) {
      const { error: insertError } = await supabase.from("companies").insert(payload);
      if (!insertError) return;
      throw insertError;
    }
    throw error;
  }
  throw new Error("Could not upsert companies after dropping unknown columns.");
}

async function main() {
  const token = requireEnv("APIFY_API_TOKEN");
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const scrapedAt = new Date().toISOString();

  if (!supabaseUrl) {
    throw new Error(
      "Missing supabaseUrl. Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in GitHub Actions secrets (or .env.local) before createClient() runs. Expected a project URL like https://<project-ref>.supabase.co.",
    );
  }

  const items = await fetchNews(token);
  const rows = dedupeCompanies(items.map((item) => toCompanyRow(item, scrapedAt)).filter(Boolean));

  if (rows.length === 0) {
    console.log("No company rows parsed from Apify results; leaving Supabase unchanged.");
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await upsertCompanies(supabase, rows);
  console.log(`Upserted ${rows.length} companies into Supabase.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
