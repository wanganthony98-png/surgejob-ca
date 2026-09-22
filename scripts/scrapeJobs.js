/**
 * Daily Apify → OpenAI (Structured Outputs) → Supabase pipeline.
 * Required env: APIFY_API_TOKEN, OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { ApifyClient } = require("apify-client");
const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");

const APIFY_ACTOR = process.env.APIFY_ACTOR || "scrapeify/google-news-scraper";
const NEWS_QUERY =
  process.env.APIFY_NEWS_QUERY ||
  'Canada ("startup" OR "start-up") (funding OR "raises" OR "Series A" OR "Series B" OR hiring OR "is hiring") (tech OR AI OR SaaS)';
const LLM_MODEL = "gpt-4o-mini";
const ACTIVE_WINDOW_DAYS = 180;
const JOB_FRESHNESS_DAYS = 30;
/** Concurrent LinkedIn/ATS enrichments per wave (2–3). */
const LINKEDIN_ENRICH_BATCH_SIZE = Math.min(
  3,
  Math.max(2, Number(process.env.LINKEDIN_ENRICH_BATCH_SIZE || 3) || 3),
);

/** STRICT SANDBOX: only these brands are processed this run. */
const SANDBOX_TEST_MODE = false;
const TEST_COMPANIES = ["Cohere", "Waabi"];

/** Permanent brands that must never be wiped during cleanup sync. */
const ANCHOR_COMPANIES = [
  "Cohere",
  "Waabi",
  "TransCrypts",
  "Haply Robotics",
  "Simuhealth",
  "Taalas",
];

/** Non-startup global giants — never scrape or upsert. */
const GLOBAL_GIANTS_BLACKLIST = [
  "Nvidia",
  "NVIDIA",
  "Microsoft",
  "Google",
  "Amazon",
  "Meta",
  "Apple",
  "Alphabet",
  "OpenAI",
  "IBM",
  "Oracle",
  "Salesforce",
  "Intel",
];

const ANCHOR_COMPANY_SET = new Set(ANCHOR_COMPANIES.map((n) => n.toLowerCase()));
const GLOBAL_GIANTS_SET = new Set(GLOBAL_GIANTS_BLACKLIST.map((n) => n.toLowerCase()));

function isAnchorCompany(name) {
  return ANCHOR_COMPANY_SET.has(String(name || "").trim().toLowerCase());
}

function isBlacklistedGiant(name) {
  const key = String(name || "").trim().toLowerCase();
  if (!key) return false;
  if (GLOBAL_GIANTS_SET.has(key)) return true;
  return [...GLOBAL_GIANTS_SET].some(
    (giant) => key === giant || key.startsWith(`${giant} `) || key.includes(` ${giant}`),
  );
}

const LINKEDIN_COMPANY_MAP = {
  Cohere: {
    linkedin_url: "https://www.linkedin.com/company/cohere-ai",
    careers_url: "https://cohere.com/careers",
    tagline: "Builds frontier language models and AI platforms for enterprises.",
    industry: "AI & Data",
    hq_city: "Toronto",
    location_region: "GTA",
    funding_round: "Series D",
    funding_amount: "$500M",
    funding_date: "2026-08-01",
    lead_investor: "Undisclosed",
  },
  Waabi: {
    linkedin_url: "https://www.linkedin.com/company/waabi",
    careers_url: "https://waabi.ai/careers",
    tagline: "Develops autonomous trucking technology with simulation-first AI.",
    industry: "Autonomous Driving",
    hq_city: "Toronto",
    location_region: "GTA",
    funding_round: "Series B/Growth",
    funding_amount: "$200M",
    funding_date: "2026-07-15",
    lead_investor: "Undisclosed",
  },
  TransCrypts: {
    linkedin_url: "https://www.linkedin.com/company/transcrypts",
    careers_url: "https://transcrypts.com/careers",
    tagline: "Builds identity and document verification infrastructure for enterprises.",
    industry: "Privacy & Security",
    hq_city: "Toronto",
    location_region: "GTA",
    funding_round: "Seed",
    funding_amount: null,
    funding_date: "2026-08-15",
    lead_investor: "Undisclosed",
  },
  "Haply Robotics": {
    linkedin_url: "https://www.linkedin.com/company/haplyrobotics",
    careers_url: "https://haply.co/careers",
    tagline: "Builds haptic robotics interfaces for digital and industrial workflows.",
    industry: "Robotics",
    hq_city: "Montreal",
    location_region: "Montreal Area",
    funding_round: "Series A",
    funding_amount: null,
    funding_date: "2026-07-01",
    lead_investor: "Undisclosed",
  },
  Simuhealth: {
    linkedin_url: "https://www.linkedin.com/company/simuhealth",
    careers_url: "https://simuhealth.com/careers",
    tagline: "Builds simulation and digital health training platforms.",
    industry: "HealthTech",
    hq_city: "Toronto",
    location_region: "GTA",
    funding_round: "Seed",
    funding_amount: null,
    funding_date: "2026-08-01",
    lead_investor: "Undisclosed",
  },
  Taalas: {
    linkedin_url: "https://www.linkedin.com/company/taalas",
    careers_url: "https://taalas.com/careers",
    tagline: "Designs AI semiconductor chips for accelerated inference workloads.",
    industry: "Semiconductors",
    hq_city: "Toronto",
    location_region: "GTA",
    funding_round: "Series A/B",
    funding_amount: "$169M CAD",
    funding_date: "2026-08-20",
    lead_investor: "Undisclosed",
  },
};

const LINKEDIN_URL_FALLBACKS = {
  Cohere: "https://www.linkedin.com/company/cohere-ai",
  Waabi: "https://www.linkedin.com/company/waabi",
  TransCrypts: "https://www.linkedin.com/company/transcrypts",
  "Haply Robotics": "https://www.linkedin.com/company/haplyrobotics",
  Simuhealth: "https://www.linkedin.com/company/simuhealth",
  Taalas: "https://www.linkedin.com/company/taalas",
};

const LINKEDIN_SLUG_SUFFIXES = [
  "technologies",
  "technology",
  "tech",
  "ai",
  "labs",
  "robotics",
  "systems",
  "inc",
];

/**
 * Build LinkedIn company slug candidates from a brand name.
 * 1) Merged (haplyrobotics / simuhealth)
 * 2) Hyphenated (haply-robotics)
 * 3) Expanded with common suffixes (simuhealth-technologies, haply-robotics-inc)
 * Never rely on a single guessed slug for LinkedIn resolution.
 */
function linkedInSlugCandidates(value) {
  const raw = String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  if (!raw) return [];

  const tokens = raw.split(" ").filter(Boolean);
  const merged = tokens.join("").replace(/-+/g, "");
  const hyphenated = tokens.join("-").replace(/-+/g, "-").replace(/^-|-$/g, "");

  const candidates = [];
  const push = (slug) => {
    if (slug && !candidates.includes(slug)) candidates.push(slug);
  };

  push(merged);
  push(hyphenated);

  for (const suffix of LINKEDIN_SLUG_SUFFIXES) {
    if (merged.endsWith(suffix) || hyphenated.endsWith(suffix)) continue;
    push(`${merged}${suffix}`);
    push(`${hyphenated}-${suffix}`);
    if (merged) push(`${merged}-${suffix}`);
  }

  return candidates;
}

/** @deprecated Prefer linkedInSlugCandidates — returns primary merged slug. */
function slugify(value) {
  return linkedInSlugCandidates(value)[0] || "";
}

/**
 * Resolve a LinkedIn company URL (primary merged slug / known map).
 * Callers that scrape jobs should prefer getLinkedInUrlCandidates + name search.
 */
function getLinkedInUrl(companyName, domain) {
  const name = String(companyName || "").trim();
  const mappedKey = Object.keys(LINKEDIN_URL_FALLBACKS).find(
    (key) => key.toLowerCase() === name.toLowerCase(),
  );
  if (mappedKey) return LINKEDIN_URL_FALLBACKS[mappedKey];

  const fromCompanyMap =
    LINKEDIN_COMPANY_MAP[name]?.linkedin_url ||
    Object.entries(LINKEDIN_COMPANY_MAP).find(
      ([key]) => key.toLowerCase() === name.toLowerCase(),
    )?.[1]?.linkedin_url;
  if (fromCompanyMap) return fromCompanyMap;

  let slugSource = name;
  if (domain) {
    const host = String(domain)
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .split(":")[0];
    const label = host.split(".")[0];
    if (label && !/\s/.test(label)) {
      return `https://www.linkedin.com/company/${label.toLowerCase().replace(/[^a-z0-9-]/g, "")}`;
    }
    if (label) slugSource = label;
  }

  const [primary] = linkedInSlugCandidates(slugSource);
  return `https://www.linkedin.com/company/${primary || "company"}`;
}

/** All candidate LinkedIn company page URLs (merged → hyphenated → suffix expansions). */
function getLinkedInUrlCandidates(companyName, domain) {
  const primary = getLinkedInUrl(companyName, domain);
  const name = String(companyName || "").trim();
  const slugs = linkedInSlugCandidates(name);
  const urls = [primary, ...slugs.map((s) => `https://www.linkedin.com/company/${s}`)];
  return [...new Set(urls.filter(Boolean))];
}

function withRequiredLinkedInUrl(row) {
  const linkedin_url =
    (row.linkedin_url && String(row.linkedin_url).trim()) ||
    getLinkedInUrl(row.name, row.domain || row.website || row.hq_city);
  return { ...row, linkedin_url };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value) {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

/**
 * Ensure companies.id is never null for upsert/insert.
 * Keep a valid existing UUID; otherwise assign crypto.randomUUID().
 */
function ensureCompanyRowId(row, existingIdByName) {
  const next = { ...row };
  if (isValidUuid(next.id)) return next;

  const key = String(next.name || "").trim().toLowerCase();
  const fromDb = key && existingIdByName ? existingIdByName.get(key) : null;
  if (isValidUuid(fromDb)) {
    next.id = fromDb;
    return next;
  }

  // Explicit null/undefined/invalid → fresh UUID (never send id: null to Postgres).
  next.id = randomUUID();
  return next;
}
const LINKEDIN_JOBS_ACTOR =
  process.env.LINKEDIN_JOBS_ACTOR || "curious_coder/linkedin-jobs-scraper";
const LINKEDIN_JOBS_FALLBACK_ACTORS = [
  "api-empire/linkedin-search-jobs-scraper",
  "scrapapi/linkedin-jobs-scraper",
  "bebity/linkedin-jobs-scraper",
];

const INDUSTRIES = [
  "Fintech",
  "AI & Data",
  "Cleantech & Energy",
  "CleanTech",
  "B2B SaaS",
  "Privacy & Security",
  "AgTech",
  "FoodTech",
  "Telecom & Infra",
  "Hardware & Robotics",
  "Robotics",
  "Autonomous Driving",
  "Semiconductors",
  "HealthTech",
  "Others",
];

const LOCATION_REGIONS = [
  "GTA",
  "SW Ontario",
  "Greater Vancouver",
  "Montreal Area",
  "Ottawa Region",
  "Others",
];

/** Publisher / noise tokens — matched as whole words only (avoid "found" ⊂ "Foundry"). */
const INVALID_NAME_TOKEN_RE =
  /\b(canada|canadian|startup|start-up|funding|betakit|techcrunch|bloomberg|pymnts|calcalist|unknown|undisclosed|series\s+[a-d]|million|billion|sluggish|growth|problems?|economy|opinion|analysis)\b/i;

const HEADLINE_VERB_RE =
  /\b(raises?|raised|secures?|secured|closes?|closed|lands?|landed|announces?|announced|finds?|bags?|nabs?|snags?|pulls in|inks|scores|loses?|lost|faces?|warns?|says|said)\b/i;

/** Non-company / macro / industry-roundup titles — reject immediately. */
const NON_COMPANY_NEWS_RE =
  /\b(sluggish growth|lost value|canada has problems|startup funding\s*q[1-4]|funding roundup|funding recap|economy (slows|shrinks)|market (crash|rout)|opinion:|analysis:|editorial|here are the tech startups|what decades of data)\b/i;

const NAME_STOPWORDS = new Set(
  [
    "has",
    "have",
    "had",
    "the",
    "and",
    "for",
    "with",
    "from",
    "this",
    "that",
    "what",
    "when",
    "how",
    "why",
    "who",
    "new",
    "news",
    "report",
    "update",
    "ceo",
    "inc",
    "ltd",
    "rs",
    "self",
    "start",
    "funding",
  ].map((s) => s.toLowerCase()),
);

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    is_valid_funding_news: {
      type: "boolean",
      description:
        "True ONLY for a named Canadian tech company funding/hiring story. False for macro/economy/opinion pieces or when no brand can be isolated.",
    },
    name: {
      type: ["string", "null"],
      description:
        'Pure registered brand ONLY. "Canadian Startup TransCrypts Raises…" → "TransCrypts". Never "AI Fraud", headlines, or industry phrases.',
    },
    funding_date: {
      type: ["string", "null"],
      description:
        "Funding/event date as YYYY-MM-DD. Convert relative phrases (e.g. '2 days ago', 'last week') to an exact ISO date using today as anchor. Never return relative text.",
    },
    funding_stage: {
      type: ["string", "null"],
      description:
        'Exact round from text when present: "Seed", "Series A", "Series B", "Series C", "Growth", "Series B/Growth", etc.',
    },
    funding_amount: {
      type: ["string", "null"],
      description:
        'Exact amount from text with currency when present, e.g. "$1B", "$169M CAD", "C$50M".',
    },
    industry: {
      type: "string",
      enum: INDUSTRIES,
    },
    hq_city: {
      type: ["string", "null"],
      description: 'HQ city such as "Waterloo" or "Toronto".',
    },
    location_region: {
      type: "string",
      enum: LOCATION_REGIONS,
    },
    tagline: {
      type: ["string", "null"],
      description: "One concise sentence (max 20 words) about what the product does.",
    },
    lead_investor: {
      type: "string",
      description: 'Prominent VC firm, or "Undisclosed" if not mentioned. Never "Unknown".',
    },
    open_roles: {
      type: "array",
      description:
        "Roles ONLY when the article explicitly lists them with a real apply URL in the text. Prefer empty array.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          location: { type: ["string", "null"] },
          job_url: {
            type: ["string", "null"],
            description:
              "Copy the exact URL from the source if present. NEVER invent, guess, or generate LinkedIn/job URLs. null when absent.",
          },
        },
        required: ["title", "location", "job_url"],
      },
    },
    radar_data: {
      type: "object",
      additionalProperties: false,
      properties: {
        growth: { type: "integer", minimum: 50, maximum: 95 },
        product: { type: "integer", minimum: 50, maximum: 95 },
        market: { type: "integer", minimum: 50, maximum: 95 },
        leadership: { type: "integer", minimum: 50, maximum: 95 },
        culture: { type: "integer", minimum: 50, maximum: 95 },
        capital: { type: "integer", minimum: 50, maximum: 95 },
      },
      required: ["growth", "product", "market", "leadership", "culture", "capital"],
    },
  },
  required: [
    "is_valid_funding_news",
    "name",
    "funding_date",
    "funding_stage",
    "funding_amount",
    "industry",
    "hq_city",
    "location_region",
    "tagline",
    "lead_investor",
    "open_roles",
    "radar_data",
  ],
};

const SYSTEM_PROMPT = `You extract Canadian tech startup company cards from funding/hiring news for SurgeJob.

CRITICAL — name field (entity resolution):
- Return ONLY the actual registered brand/company name — the string you would type into LinkedIn Company search.
- 1–3 tokens max. NEVER return article titles, headline noise, industry domains, or product categories.
- Transform examples (MUST follow exactly):
  "Canadian Startup TransCrypts Raises…" → "TransCrypts" (NOT "AI Fraud", NOT "Canadian Startup")
  "Self-driving truck company Waabi" → "Waabi"
  "Canadian start-up chipmaker Taalas" → "Taalas"
  "Telecom software startup Gaiia" → "Gaiia"
  "Haply Robotics closes …" → "Haply Robotics"
  "Simuhealth raises …" → "Simuhealth"
- Strip: geography (Canadian), entity type (Startup/Company), industry keywords (AI, Fraud, Chipmaker, Telecom, Software), verbs (Raises/Secures), publishers, amounts.

CRITICAL — reject general industry / non-company news:
- Set is_valid_funding_news=false and name=null unless the article is a SPECIFIC company fundraising or hiring announcement.
- Discard examples: "Canada has problems…", "Sluggish growth, lost value…", "Startup Funding Q1…", market roundups, opinion/analysis with no single named company raise.
- NEVER extract global giants: ${GLOBAL_GIANTS_BLACKLIST.join(", ")}. Set is_valid_funding_news=false for these.

Role / job location formatting (when describing HQ or roles):
- Canadian cities MUST be "City, Province Code" (e.g. "Toronto, ON", "Vancouver, BC", "Montreal, QC").
- Remote MUST be "Remote" or "Remote (Canada)".
- FORBIDDEN: "Ontario", "Canada", "Greater Toronto Area", "GTA", or province names alone.

open_roles (STRICT — usually empty for funding news):
- Only include a role when the article/HTML EXPLICITLY lists that job for THIS company.
- job_url: copy the exact URL from the source text/HTML for that role. If no URL is present, set job_url=null.
- NEVER invent, guess, hallucinate, or reuse example LinkedIn URLs (including any Tim Hortons / restaurant / unrelated employer links).
- Prefer returning open_roles=[] unless the source clearly enumerates roles with URLs.

Funding (extract from the article text — do NOT invent or default):
- funding_amount: exact figure when present (e.g. "$1B", "$169M CAD"). null if absent.
- funding_stage: exact round when present (e.g. "Series B", "Growth", "Series A"). null if absent. Never invent "Seed".
- funding_date: ALWAYS return strict YYYY-MM-DD when any date signal exists.
  Convert relative timestamps using TODAY as the anchor (current UTC date):
  "posted 2 days ago" / "raised 2 days ago" → today minus 2 days
  "last week" → today minus 7 days
  "yesterday" → today minus 1 day
  "this morning" / "just now" / "today" → today's date
  Never leave a relative phrase in funding_date — only ISO dates or null.

Industry (pick ONE best fit from ${INDUSTRIES.join(" | ")}):
- Prefer specific tags: Autonomous Driving, Semiconductors, Robotics, CleanTech, Telecom & Infra, AgTech, FoodTech, AI & Data, HealthTech.
- Do NOT default everything to B2B SaaS. Put sector words in industry/tagline — never in name.

Other fields:
- funding_date: YYYY-MM-DD best estimate; null if impossible.
- hq_city: city only. location_region: one of ${LOCATION_REGIONS.join(" | ")}.
- tagline: 1 sentence, max 20 words, what the product does (no funding/news wording).
- lead_investor: VC name or "Undisclosed". Never "Unknown".
- radar_data: growth/product/market/leadership/culture/capital integers 50–95.`;

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

for (const key of ["APIFY_API_TOKEN", "SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY"]) {
  if (missingEnv(key)) {
    console.error(
      `Missing ${key}. Add it as a GitHub Actions secret (or to .env.local for local runs) and re-run the scraper.`,
    );
    process.exit(1);
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function clampRadar(n) {
  const value = Number.isFinite(Number(n)) ? Math.round(Number(n)) : 60;
  return Math.max(50, Math.min(95, value));
}

function toTitleCaseName(name) {
  return String(name)
    .trim()
    .split(/\s+/)
    .map((part) => {
      if (/^[A-Z0-9]{2,}$/.test(part)) return part;
      if (/^\d/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

/** Industry / product descriptors that must never appear in the saved brand name. */
const INDUSTRY_QUALIFIER_ALT =
  "self[- ]?driving|self|driving|truck|trucks|trucking|telecom|telecommunications|software|saas|b2b|ai|ml|llm|fraud|autonomous|chipmaker|chip\\s*makers?|semiconductor|semiconductors|fintech|healthtech|medtech|biotech|cleantech|agtech|foodtech|deeptech|climatetech|robotics|robot|hardware|security|cyber|privacy|cloud|data|analytics|mobility|logistics|payments?|banking|insurtech|enterprise|digital|platform|platforms|tech|technology|generative|language|models?|network|networks|infra|infrastructure|connectivity|broadband|carrier|isp|farm|farming|plant[- ]based|vertical|greenhouse|startup|start[- ]?ups?|start|canadian|canada|funding|round|series|company|companies|maker|makers";

const INDUSTRY_QUALIFIER_TOKEN_RE = new RegExp(`^(?:${INDUSTRY_QUALIFIER_ALT})$`, "i");

const LEADING_QUALIFIERS_RE = new RegExp(
  `^(?:${INDUSTRY_QUALIFIER_ALT})(?:\\s+(?:${INDUSTRY_QUALIFIER_ALT}))*\\s+`,
  "i",
);
const TRAILING_QUALIFIERS_RE = new RegExp(
  `\\s+(?:${INDUSTRY_QUALIFIER_ALT})(?:\\s+(?:${INDUSTRY_QUALIFIER_ALT}))*$`,
  "i",
);

/** Multi-word garbage prefixes common in LLM / headline collisions. */
const GARBAGE_PREFIX_RE =
  /^(?:self[- ]?driving(?:\s+truck)?(?:\s+company)?|canadian\s+start[- ]?ups?(?:\s+chipmakers?)?|telecom\s+software(?:\s+start[- ]?ups?)?|startup\s+funding|start[- ]?up\s+funding|ai\s+company|software\s+company|tech\s+company|chip\s*maker)\s+/i;

/**
 * Strip industry buzzwords / news adjectives so only the pure brand remains.
 * "Self-driving truck company Waabi" → "Waabi", "Canadian start-up chipmaker Taalas" → "Taalas"
 */
function stripIndustryQualifiers(name) {
  if (!name) return null;
  let text = String(name).replace(/\s+/g, " ").trim();
  if (!text) return null;

  let prev = "";
  while (text !== prev) {
    prev = text;
    text = text
      .replace(GARBAGE_PREFIX_RE, "")
      .replace(LEADING_QUALIFIERS_RE, "")
      .replace(TRAILING_QUALIFIERS_RE, "")
      .trim();
  }

  // Descriptor … brand: keep the final proper-noun-like token(s).
  const trailingBrand = text.match(
    /(?:^|\s)(?:company|startup|start-up|chipmaker|maker)\s+([A-Za-z0-9][A-Za-z0-9./&'-]{1,40})$/i,
  );
  if (trailingBrand?.[1]) {
    text = trailingBrand[1].trim();
  }

  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    let start = 0;
    while (start < parts.length - 1 && INDUSTRY_QUALIFIER_TOKEN_RE.test(parts[start])) {
      start += 1;
    }
    let end = parts.length;
    while (end > start + 1 && INDUSTRY_QUALIFIER_TOKEN_RE.test(parts[end - 1])) {
      end -= 1;
    }
    text = parts.slice(start, end).join(" ").trim();
  }

  // Residual lone fragments like "Self", "Canadian start"
  if (/^(self|start|funding|canadian|telecom|software)$/i.test(text)) return null;

  return text || null;
}

function cleanCompanyName(name) {
  if (!name) return null;
  const scrubbed =
    String(name)
      .replace(/\b(Inc\.?|Ltd\.?|LLC|Corp\.?|Corporation|Company|Co\.)\b/gi, "")
      .replace(/\b(Canada|Canadian|Startup|Start-up|Startups|Start-ups)\b/gi, "")
      .replace(
        /\b(raises|raised|raise|secures|secured|announces|announced|hiring|funding|closes|closed|lands|landed|finds|found)\b/gi,
        "",
      )
      .replace(/\b(BetaKit|TechCrunch|Financial Post|Globe and Mail|Bloomberg)\b/gi, "")
      .replace(/\$[\d.,]+[MBKmbk]?/g, "")
      .replace(/[-–—|:]+$/g, "")
      .replace(/\s{2,}/g, " ")
      .trim() || null;
  return stripIndustryQualifiers(scrubbed);
}

function looksLikeHeadline(name) {
  if (!name) return true;
  const text = String(name).trim();
  if (text.length < 3) return true;
  if (NAME_STOPWORDS.has(text.toLowerCase())) return true;
  if (/\.(com|ca|io|org|net|co|news)\b/i.test(text)) return true;
  if (/https?:\/\//i.test(text)) return true;
  if (NON_COMPANY_NEWS_RE.test(text)) return true;
  if (HEADLINE_VERB_RE.test(text)) return true;
  if (INVALID_NAME_TOKEN_RE.test(text)) return true;
  if (text.split(/\s+/).length > 4) return true;
  if (/\$|\d{3,}/.test(text)) return true;
  if (/[,:;]/.test(text)) return true;
  if (/^(the|a|an|this|that|how|why|what|when)\b/i.test(text)) return true;
  if (/^[A-Z]{1,2}\.?[A-Z]?\.?$/.test(text) && text.length <= 4) return true; // "Rs", "B.C."
  return false;
}

/** Stale DB rows: too-short names or headline-shaped garbage. */
function isGarbageEntityName(name) {
  if (!name || String(name).trim().length < 3) return true;
  return looksLikeHeadline(name);
}

/**
 * Prefer a clean brand entity over raw news-title collisions.
 * e.g. "Self-driving truck company Waabi" → "Waabi"
 */
function extractCompanyEntityName(rawName, articleTitle, articleSnippet) {
  const sources = [rawName, articleTitle, articleSnippet].filter(Boolean).map(String);

  for (const source of sources) {
    if (NON_COMPANY_NEWS_RE.test(source)) continue;

    const trailing = source.match(
      /(?:self[- ]?driving|canadian|telecom|software|ai|autonomous|chipmaker|startup|start-up|company)[^.]{0,60}?\b(?:company|startup|start-up|chipmaker|maker)?\s+([A-Z][A-Za-z0-9./&'-]{1,40})(?:\s+raises|\s+raised|\s+secures|\s+secured|\s+closes|\s*[.|,]|$)/i,
    );
    if (trailing?.[1]) {
      const candidate = cleanCompanyName(trailing[1]);
      if (candidate && !looksLikeHeadline(candidate)) return candidate;
    }

    const match = source.match(
      /^([A-Za-z0-9][A-Za-z0-9./&' -]{0,48}?)\s+(?:raises?|raised|secures?|secured|closes?|lands?|announces?|finds?|bags?|nabs?|snags?|pulls in)\b/i,
    );
    if (match?.[1]) {
      const candidate = cleanCompanyName(match[1]);
      if (candidate && !looksLikeHeadline(candidate)) return candidate;
    }
  }

  const cleaned = cleanCompanyName(rawName);
  if (cleaned && !looksLikeHeadline(cleaned)) return cleaned;
  return null;
}

function isInvalidCompanyName(name) {
  return isGarbageEntityName(name);
}

function cleanTagline(value) {
  if (!value) return null;
  const text = String(value)
    .replace(/surge\s*(radar|index)[^]*$/i, "")
    .replace(/\{[\s\S]*\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  const words = text.split(/\s+/).slice(0, 20);
  let tagline = words.join(" ");
  if (!/[.!?]$/.test(tagline)) tagline = `${tagline}.`;
  return tagline;
}

function normalizeFundingStage(value) {
  if (!value) return null;
  const n = String(value).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (/series\s*b\s*\/\s*growth|growth\s*\/\s*series\s*b/.test(n)) return "Series B/Growth";
  if (/series\s*a\s*\/\s*b|series\s*a\/b/.test(n)) return "Series A/B";
  if (/\bgrowth\b/.test(n) && /series\s*b/.test(n)) return "Series B/Growth";
  if (/\bgrowth\b/.test(n) && !/series/.test(n)) return "Growth";
  if (n.includes("series d")) return "Series D";
  if (n.includes("series c")) return "Series C";
  if (n.includes("series b")) return "Series B";
  if (n.includes("series a")) return "Series A";
  if (n.includes("pre seed") || n.includes("preseed")) return "Pre-seed";
  if (n.includes("seed")) return "Seed";
  return String(value).trim();
}

/** Pull amount like $1B / $169M CAD / C$50 million from free text. */
function parseFundingAmountFromText(text) {
  if (!text) return null;
  const t = String(text);
  const cad =
    t.match(
      /(?:C\$|CAD\s*\$?|\$)\s*([\d.,]+)\s*(billion|million|bn|mn|b|m)\s*(?:CAD|C\$)?/i,
    ) || t.match(/([\d.,]+)\s*(billion|million)\s*(?:CAD|Canadian)/i);
  if (!cad) return null;
  const num = cad[1].replace(/,/g, "");
  const unitRaw = (cad[2] || "").toLowerCase();
  let unit = "M";
  if (/^(billion|bn|b)$/.test(unitRaw)) unit = "B";
  else if (/^(million|mn|m)$/.test(unitRaw)) unit = "M";
  const hasCad = /cad|c\$|canadian/i.test(t.slice(Math.max(0, (cad.index || 0) - 6), (cad.index || 0) + cad[0].length + 6));
  const prefix = t.includes("C$") || hasCad ? (t.includes("C$") ? "C$" : "$") : "$";
  const suffix = hasCad && !String(prefix).startsWith("C") ? " CAD" : "";
  return `${prefix}${num}${unit}${suffix}`;
}

function parseFundingStageFromText(text) {
  if (!text) return null;
  const t = String(text);
  if (/series\s*b\s*\/\s*growth|growth\s*round|series\s*b\s+growth/i.test(t)) {
    return "Series B/Growth";
  }
  if (/series\s*a\s*\/\s*b|series\s*a\/b/i.test(t)) return "Series A/B";
  const series = t.match(/\b(pre[-\s]?seed|seed|series\s*[a-d]|growth)\b/i);
  return series ? normalizeFundingStage(series[1]) : null;
}

function normalizeFundingAmount(value) {
  if (!value) return null;
  const parsed = parseFundingAmountFromText(value);
  if (parsed) return parsed;
  const cleaned = String(value).trim();
  return cleaned || null;
}

function normalizeIndustry(value, tagline, name, articleText) {
  const hay = `${value || ""} ${tagline || ""} ${name || ""} ${articleText || ""}`.toLowerCase();
  if (/autonomous|self[- ]?driving|robotaxi|truck(ing)?\s+ai|driverless/.test(hay)) {
    return "Autonomous Driving";
  }
  if (/semiconductor|chipmaker|chip\s*maker|\bgpu\b|\bsilicon\b|asic|fpga/.test(hay)) {
    return "Semiconductors";
  }
  if (/\brobotics\b|\brobots?\b|cobot|warehouse automation/.test(hay)) return "Robotics";
  if (/cleantech|clean tech|climate|carbon|solar|battery|renewable|net[- ]zero/.test(hay)) {
    return "CleanTech";
  }
  if (/agtech|agri|farm|crop|plant[- ]based|greenhouse|vertical farm/.test(hay)) return "AgTech";
  if (/foodtech|food tech|restaurant|grocery|beverage|meal/.test(hay)) return "FoodTech";
  if (/telecom|5g|fiber|connectivity|isp|carrier|network infra|broadband/.test(hay)) {
    return "Telecom & Infra";
  }
  if (/hardware|drone|device|iot/.test(hay)) return "Hardware & Robotics";
  if (/health|medtech|biotech|pharma|clinical|patient/.test(hay)) return "HealthTech";
  if (/fintech|payment|banking|lending|insurtech/.test(hay)) return "Fintech";
  if (/\bai\b|machine learning|\bml\b|data platform|llm|foundation model/.test(hay)) {
    return "AI & Data";
  }
  if (/privacy|security|cyber|identity/.test(hay)) return "Privacy & Security";
  if (/saas|b2b software|enterprise software/.test(hay)) return "B2B SaaS";
  if (INDUSTRIES.includes(value)) return value;
  return "Others";
}

function normalizeRegion(value, city) {
  if (LOCATION_REGIONS.includes(value)) return value;
  const hay = `${value || ""} ${city || ""}`.toLowerCase();
  if (/(toronto|mississauga|brampton|markham|vaughan|gta)/.test(hay)) return "GTA";
  if (/(waterloo|kitchener|cambridge|london|guelph|sw ontario)/.test(hay)) return "SW Ontario";
  if (/(vancouver|burnaby|surrey|richmond|victoria)/.test(hay)) return "Greater Vancouver";
  if (/(montreal|laval|longueuil)/.test(hay)) return "Montreal Area";
  if (/(ottawa|kanata|gatineau)/.test(hay)) return "Ottawa Region";
  return "Others";
}

function normalizeFundingDate(value) {
  if (!value) return null;
  const match = String(value).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function daysAgoIso(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function isActiveFundingDate(fundingDate) {
  if (!fundingDate) return false;
  return fundingDate >= daysAgoIso(ACTIVE_WINDOW_DAYS);
}

function isFreshFundingDate(fundingDate, days = 30) {
  if (!fundingDate) return false;
  return fundingDate >= daysAgoIso(days);
}

function hasValidRadarScores(radar) {
  if (!radar || typeof radar !== "object") return false;
  const keys = ["growth", "product", "market", "leadership", "culture", "capital"];
  return keys.every((key) => typeof radar[key] === "number" && Number.isFinite(radar[key]));
}

/** Active when open roles exist OR verified funding signal (fresh date ≤30d, or amount+round from news). */
function computeIsActive(row) {
  const openRoles = Number(row.open_role_count) || 0;
  if (openRoles > 0) return true;
  if (Array.isArray(row.peer_roles) && row.peer_roles.length > 0) return true;
  if (isFreshFundingDate(row.funding_date, 30)) return true;
  // Funding news with an extracted amount + round is a verified capital signal for the board.
  if (row.funding_amount && row.funding_round) return true;
  return false;
}

function looksLikeAtsCareersUrl(url) {
  if (!url) return false;
  return /(greenhouse\.io|lever\.co|ashbyhq\.com|jobs\.|careers\.|\/\/boards\.)/i.test(String(url));
}

/**
 * Pull open roles from public Greenhouse / Lever / Ashby board endpoints when URL is known.
 * Returns [] when the URL is not an ATS board or the fetch fails.
 */
async function fetchAtsJobsFromCareersUrl(careersUrl, companyName) {
  if (!careersUrl || !looksLikeAtsCareersUrl(careersUrl)) return [];
  const url = String(careersUrl).trim();
  const locationFallback = "Canada";

  try {
    // boards.greenhouse.io/<slug>  OR  job-boards.greenhouse.io/<slug>
    const gh = url.match(
      /(?:boards|job-boards)\.greenhouse\.io\/([a-zA-Z0-9_-]+)/i,
    );
    if (gh?.[1]) {
      const api = `https://boards-api.greenhouse.io/v1/boards/${gh[1]}/jobs`;
      console.log(`[ATS] ${companyName}: Greenhouse board ${gh[1]}…`);
      const res = await fetch(api, { headers: { Accept: "application/json" } });
      if (!res.ok) return [];
      const data = await res.json();
      const jobs = (data.jobs || [])
        .map((job) => ({
          title: String(job.title || "").trim(),
          location: String(job.location?.name || locationFallback).trim(),
          posted_date: job.updated_at
            ? String(job.updated_at).slice(0, 10)
            : null,
          apply_url: String(job.absolute_url || url).trim(),
        }))
        .filter((j) => j.title && j.apply_url)
        .filter(isFreshJob);
      console.log(`[ATS] ${companyName}: ${jobs.length} Greenhouse roles.`);
      return jobs;
    }

    // jobs.lever.co/<slug>
    const lever = url.match(/jobs\.lever\.co\/([a-zA-Z0-9_-]+)/i);
    if (lever?.[1]) {
      const api = `https://api.lever.co/v0/postings/${lever[1]}?mode=json`;
      console.log(`[ATS] ${companyName}: Lever board ${lever[1]}…`);
      const res = await fetch(api, { headers: { Accept: "application/json" } });
      if (!res.ok) return [];
      const data = await res.json();
      const jobs = (Array.isArray(data) ? data : [])
        .map((job) => ({
          title: String(job.text || job.title || "").trim(),
          location: String(
            job.categories?.location || job.workplaceType || locationFallback,
          ).trim(),
          posted_date: job.createdAt
            ? new Date(job.createdAt).toISOString().slice(0, 10)
            : null,
          apply_url: String(job.hostedUrl || job.applyUrl || url).trim(),
        }))
        .filter((j) => j.title && j.apply_url)
        .filter(isFreshJob);
      console.log(`[ATS] ${companyName}: ${jobs.length} Lever roles.`);
      return jobs;
    }

    // jobs.ashbyhq.com/<slug>
    const ashby = url.match(/jobs\.ashbyhq\.com\/([a-zA-Z0-9_-]+)/i);
    if (ashby?.[1]) {
      const api = `https://api.ashbyhq.com/posting-api/job-board/${ashby[1]}`;
      console.log(`[ATS] ${companyName}: Ashby board ${ashby[1]}…`);
      const res = await fetch(api, { headers: { Accept: "application/json" } });
      if (!res.ok) return [];
      const data = await res.json();
      const jobs = (data.jobs || [])
        .map((job) => ({
          title: String(job.title || "").trim(),
          location: String(
            job.location || job.secondaryLocations?.[0] || locationFallback,
          ).trim(),
          posted_date: job.publishedAt
            ? String(job.publishedAt).slice(0, 10)
            : null,
          apply_url: String(job.jobUrl || job.applyUrl || url).trim(),
        }))
        .filter((j) => j.title && j.apply_url)
        .filter(isFreshJob);
      console.log(`[ATS] ${companyName}: ${jobs.length} Ashby roles.`);
      return jobs;
    }
  } catch (error) {
    console.warn(
      `[ATS] ${companyName} board fetch failed:`,
      error?.message || error,
    );
  }
  return [];
}

const TIER1_INVESTORS = [
  "a16z",
  "andreessen",
  "sequoia",
  "inovia",
  "bdc",
  "softbank",
  "index ventures",
  "accel",
  "benchmark",
  "greylock",
  "tiger global",
  "coatue",
  "insight partners",
  "gv",
  "google ventures",
  "founders fund",
  "khosla",
  "radical ventures",
  "version one",
];

function hashSeed(input) {
  let h = 2166136261;
  for (let i = 0; i < String(input).length; i += 1) {
    h ^= String(input).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function jitter(seed, lane, min, max) {
  if (max <= min) return min;
  const unit = ((seed >>> (lane % 24)) ^ Math.imul(seed, lane + 11)) >>> 0;
  const t = (unit % 1000) / 999;
  return Math.round(min + t * (max - min));
}

function parseFundingMillions(amount) {
  if (!amount) return 0;
  const text = String(amount).replace(/,/g, "").trim().toUpperCase();
  const match = text.match(/([\d.]+)\s*([MBK])?/);
  if (!match) return 0;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return 0;
  if (match[2] === "B") return value * 1000;
  if (match[2] === "M") return value;
  if (match[2] === "K") return value / 1000;
  return value;
}

function roleCountFromCompany(company) {
  if (typeof company.open_role_count === "number" && company.open_role_count > 0) {
    return company.open_role_count;
  }
  const signal = String(company.hiring_signal || "");
  const fromSignal = signal.match(/(\d+)\+?/);
  if (fromSignal) return Number(fromSignal[1]);
  return Array.isArray(company.peer_roles) ? company.peer_roles.length : 0;
}

function parseHeadcountEstimate(headcount) {
  if (!headcount) return 40;
  const text = String(headcount);
  const plus = text.match(/(\d+)\+/);
  if (plus) return Number(plus[1]) + 50;
  const range = text.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2);
  const single = text.match(/(\d+)/);
  return single ? Number(single[1]) : 40;
}

function departmentDiversity(roles) {
  if (!Array.isArray(roles) || roles.length === 0) return 0;
  const buckets = new Set();
  for (const role of roles) {
    const title = String(role.title || "").toLowerCase();
    if (/engineer|infra|sre|gpu|software|ml|research/.test(title)) buckets.add("eng");
    else if (/product|pm\b/.test(title)) buckets.add("product");
    else if (/design|ux/.test(title)) buckets.add("design");
    else if (/sales|business development|bdr|account/.test(title)) buckets.add("gtm");
    else if (/people|hr|recruit|talent/.test(title)) buckets.add("people");
    else if (/market|comms|brand/.test(title)) buckets.add("marketing");
    else if (/finance|legal|ops|it\b|network|admin/.test(title)) buckets.add("ops");
    else buckets.add("other");
  }
  return buckets.size;
}

function fundingFreshnessBoost(fundingDate) {
  if (!fundingDate) return 0;
  const funded = new Date(`${fundingDate}T00:00:00Z`);
  if (Number.isNaN(funded.getTime())) return 0;
  const days = Math.max(0, Math.round((Date.now() - funded.getTime()) / 86400000));
  if (days <= 30) return 12;
  if (days <= 90) return 8;
  if (days <= 180) return 4;
  return 0;
}

/**
 * Dynamic radar scores (0-100) from live company metadata.
 * Ensures companies get distinct polygons via a name/metadata seed.
 */
function calculateRadarScores(company) {
  const roles = roleCountFromCompany(company);
  const peerRoles = Array.isArray(company.peer_roles) ? company.peer_roles : [];
  const seed = hashSeed(
    [
      company.name,
      company.industry || "",
      company.funding_round || "",
      company.funding_amount || "",
      company.funding_date || "",
      company.lead_investor || "",
      String(roles),
    ].join("|"),
  );

  let growth;
  if (roles > 20) growth = jitter(seed, 1, 92, 98);
  else if (roles >= 10) growth = jitter(seed, 1, 80, 90);
  else if (roles >= 5) growth = jitter(seed, 1, 75, 85);
  else if (roles > 0) growth = jitter(seed, 1, 65, 75);
  else growth = jitter(seed, 1, 55, 68);

  const millions = parseFundingMillions(company.funding_amount);
  const stage = String(company.funding_round || "").toLowerCase();
  let capital;
  if (stage.includes("series d") || stage.includes("series e") || millions >= 250) {
    capital = jitter(seed, 2, 90, 98);
  } else if (stage.includes("series c") || millions >= 80) capital = jitter(seed, 2, 86, 94);
  else if (stage.includes("series b") || millions >= 30) capital = jitter(seed, 2, 80, 90);
  else if (stage.includes("series a") || millions >= 8) capital = jitter(seed, 2, 75, 85);
  else if (stage.includes("seed") || stage.includes("pre")) capital = jitter(seed, 2, 60, 72);
  else capital = jitter(seed, 2, 62, 78);

  const size = parseHeadcountEstimate(company.headcount || company.size);
  const diversity = departmentDiversity(peerRoles);
  let marketBase = 62;
  if (size >= 200) marketBase = 88;
  else if (size >= 100) marketBase = 82;
  else if (size >= 50) marketBase = 76;
  else if (size >= 20) marketBase = 70;
  marketBase += Math.min(10, diversity * 2);
  const market = clampRadar(jitter(seed, 3, marketBase - 3, marketBase + 4));

  const investor = String(company.lead_investor || "").toLowerCase();
  const tier1 = TIER1_INVESTORS.some((name) => investor.includes(name));
  let leadership;
  if (tier1) leadership = jitter(seed, 4, 86, 96);
  else if (investor && investor !== "undisclosed") leadership = jitter(seed, 4, 74, 86);
  else leadership = jitter(seed, 4, 62, 74);

  const sector = String(company.industry || "").toLowerCase();
  let productLo = 68;
  let productHi = 80;
  if (/ai|data|ml|machine/.test(sector)) {
    productLo = 82;
    productHi = 94;
  } else if (/fintech|finance|pay/.test(sector)) {
    productLo = 78;
    productHi = 90;
  } else if (/hardware|robot|autonom|cleantech|energy/.test(sector)) {
    productLo = 80;
    productHi = 92;
  } else if (/saas|b2b|software/.test(sector)) {
    productLo = 74;
    productHi = 88;
  }
  if (roles >= 10) {
    productLo += 2;
    productHi = Math.min(98, productHi + 3);
  }
  const product = jitter(seed, 5, productLo, productHi);

  const freshness = fundingFreshnessBoost(company.funding_date);
  let cultureLo = 62 + Math.min(10, Math.floor(roles / 2)) + Math.floor(freshness / 2);
  let cultureHi = cultureLo + 10 + freshness;
  const culture = clampRadar(jitter(seed, 6, cultureLo, cultureHi));

  const radar = {
    growth: clampRadar(growth + ((seed % 3) - 1)),
    product: clampRadar(product + (((seed >>> 3) % 3) - 1)),
    market: clampRadar(market + (((seed >>> 6) % 3) - 1)),
    leadership: clampRadar(leadership + (((seed >>> 9) % 3) - 1)),
    culture: clampRadar(culture + (((seed >>> 12) % 3) - 1)),
    capital: clampRadar(capital + (((seed >>> 15) % 3) - 1)),
  };
  return radar;
}

function normalizeRadarData(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    growth: clampRadar(source.growth),
    product: clampRadar(source.product),
    market: clampRadar(source.market),
    leadership: clampRadar(source.leadership),
    culture: clampRadar(source.culture),
    capital: clampRadar(source.capital),
  };
}

function surgeFromRadar(radar) {
  return Math.round(
    (radar.growth + radar.product + radar.market + radar.leadership + radar.culture + radar.capital) / 6,
  );
}

function normalizeLeadInvestor(value) {
  const cleaned = String(value || "").trim();
  if (!cleaned || /^unknown$/i.test(cleaned) || /^n\/?a$/i.test(cleaned)) return "Undisclosed";
  return cleaned;
}

function createOpenAIClient(apiKey) {
  return new OpenAI({ apiKey });
}

async function extractWithOpenAI(openai, item) {
  const title = String(item.title || item.headline || "").trim();
  const snippet = String(item.description || item.snippet || item.summary || "").trim();
  if (!title && !snippet) return null;
  if (NON_COMPANY_NEWS_RE.test(`${title} ${snippet}`)) {
    console.log(`[LLM] Rejected non-company news: ${title.slice(0, 80)}`);
    return { is_valid_funding_news: false, name: null };
  }

  console.log(`[LLM Processing] Querying model: ${LLM_MODEL}...`);
  const todayIso = new Date().toISOString().slice(0, 10);
  const response = await openai.chat.completions.create({
    model: LLM_MODEL,
    temperature: 0,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "surgejob_company_extraction",
        strict: true,
        schema: EXTRACTION_SCHEMA,
      },
    },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          title,
          snippet,
          today_utc: todayIso,
          instruction:
            "Convert any relative dates (e.g. 'posted 2 days ago') to YYYY-MM-DD using today_utc as the anchor.",
        }),
      },
    ],
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    console.warn("OpenAI returned non-JSON content; skipping item.");
    return null;
  }
}

function toCompanyRow(extracted, sourceItem) {
  if (!extracted || extracted.is_valid_funding_news === false) return null;

  const articleTitle = String(sourceItem?.title || sourceItem?.headline || "").trim();
  const articleSnippet = String(
    sourceItem?.description || sourceItem?.snippet || sourceItem?.summary || "",
  ).trim();
  const articleText = `${articleTitle} ${articleSnippet}`;
  if (NON_COMPANY_NEWS_RE.test(articleText)) return null;

  const cleaned = extractCompanyEntityName(extracted.name, articleTitle, articleSnippet);
  if (!cleaned || isInvalidCompanyName(cleaned)) return null;

  const name = toTitleCaseName(cleaned);
  if (name.length < 3) return null;
  if (isBlacklistedGiant(name)) {
    console.log(`[Blacklist] Skipping global giant: ${name}`);
    return null;
  }

  const tagline =
    cleanTagline(extracted.tagline) ||
    "Canadian tech product company building for growth.";
  const funding_date = normalizeFundingDate(extracted.funding_date);
  const hq_city = extracted.hq_city ? String(extracted.hq_city).trim() : null;
  const location_region = normalizeRegion(extracted.location_region, hq_city);
  const industry = normalizeIndustry(extracted.industry, tagline, name, articleText);
  const location = sanitizeRoleLocation(
    hq_city ? `${hq_city}, ${location_region}` : location_region,
  );

  const funding_round =
    normalizeFundingStage(extracted.funding_stage) ||
    parseFundingStageFromText(articleText) ||
    null;
  const funding_amount =
    normalizeFundingAmount(extracted.funding_amount) ||
    parseFundingAmountFromText(articleText) ||
    null;

  const careersGuess = null;
  const openRolesFromLlm = Array.isArray(extracted.open_roles)
    ? extracted.open_roles
        .map((role) => {
          const title = String(role?.title || "").trim();
          if (!title) return null;
          const jobUrl = resolveRoleApplyUrl(role?.job_url, careersGuess);
          return {
            title,
            location: sanitizeRoleLocation(role?.location),
            url: jobUrl,
            posted_at: null,
          };
        })
        .filter(Boolean)
    : [];

  const row = {
    name,
    tagline,
    mission: tagline,
    funding_date,
    funding_round,
    funding_amount,
    industry,
    hq_city,
    location_region,
    location,
    lead_investor: normalizeLeadInvestor(extracted.lead_investor),
    peer_roles: openRolesFromLlm,
    open_role_count: openRolesFromLlm.length,
    linkedin_url: getLinkedInUrl(name),
    freshness: aggregateCompanyFreshness(openRolesFromLlm),
  };
  const radar_data = calculateRadarScores(row);
  const withRadar = {
    ...row,
    radar_data,
    surge_index: surgeFromRadar(radar_data),
  };
  return {
    ...withRadar,
    is_active: computeIsActive(withRadar),
  };
}

function buildSandboxCompanyRows() {
  return TEST_COMPANIES.map((name) => {
    const meta = LINKEDIN_COMPANY_MAP[name];
    if (!meta) return null;
    const base = {
      name,
      tagline: meta.tagline,
      mission: meta.tagline,
      funding_date: meta.funding_date,
      funding_round: meta.funding_round,
      funding_amount: meta.funding_amount,
      industry: meta.industry,
      hq_city: meta.hq_city,
      location_region: meta.location_region,
      location: `${meta.hq_city} · ${meta.location_region}`,
      lead_investor: meta.lead_investor,
      headcount: "51-200",
      is_active: isActiveFundingDate(meta.funding_date),
      linkedin_url: getLinkedInUrl(name, meta.careers_url),
      apply_url: meta.careers_url,
      hiring_signal: "No Active Roles",
      peer_roles: [],
      open_role_count: 0,
    };
    const radar_data = calculateRadarScores(base);
    const withRadar = {
      ...base,
      radar_data,
      surge_index: surgeFromRadar(radar_data),
    };
    return {
      ...withRadar,
      is_active: computeIsActive(withRadar),
    };
  }).filter(Boolean);
}

function parseJobPostedDate(raw) {
  if (!raw) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const ms = raw > 1e12 ? raw : raw * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  const text = String(raw).trim();
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const relative = text.toLowerCase();
  const now = new Date();
  const hours = relative.match(/(\d+)\s*hour/);
  const days = relative.match(/(\d+)\s*day/);
  const weeks = relative.match(/(\d+)\s*week/);
  const months = relative.match(/(\d+)\s*month/);
  if (/just now|today|hour/.test(relative) || hours) {
    return now.toISOString().slice(0, 10);
  }
  if (days) {
    now.setUTCDate(now.getUTCDate() - Number(days[1]));
    return now.toISOString().slice(0, 10);
  }
  if (weeks) {
    now.setUTCDate(now.getUTCDate() - Number(weeks[1]) * 7);
    return now.toISOString().slice(0, 10);
  }
  if (months) {
    now.setUTCDate(now.getUTCDate() - Number(months[1]) * 30);
    return now.toISOString().slice(0, 10);
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

/**
 * Sanitize job/HQ location → "City, XX" or "Remote" / "Remote (Canada)".
 * Converts vague strings (Ontario, GTA, Canada) into filter-safe values.
 */
function sanitizeRoleLocation(raw) {
  if (!raw) return "Remote (Canada)";
  let text = String(raw).replace(/\s+/g, " ").trim();
  if (!text) return "Remote (Canada)";

  const PROVINCE_CODES = {
    ontario: "ON",
    on: "ON",
    quebec: "QC",
    qc: "QC",
    "british columbia": "BC",
    bc: "BC",
    alberta: "AB",
    ab: "AB",
    manitoba: "MB",
    mb: "MB",
    saskatchewan: "SK",
    sk: "SK",
    "nova scotia": "NS",
    ns: "NS",
    "new brunswick": "NB",
    nb: "NB",
    "newfoundland and labrador": "NL",
    newfoundland: "NL",
    nl: "NL",
    "prince edward island": "PE",
    pei: "PE",
    pe: "PE",
  };
  const CITY_DEFAULTS = {
    toronto: "Toronto, ON",
    mississauga: "Mississauga, ON",
    ottawa: "Ottawa, ON",
    waterloo: "Waterloo, ON",
    kitchener: "Kitchener, ON",
    montreal: "Montreal, QC",
    montréal: "Montreal, QC",
    vancouver: "Vancouver, BC",
    calgary: "Calgary, AB",
    edmonton: "Edmonton, AB",
  };
  const REGION_TO_CITY = {
    gta: "Toronto, ON",
    "greater toronto": "Toronto, ON",
    "greater toronto area": "Toronto, ON",
    "sw ontario": "Waterloo, ON",
    "greater vancouver": "Vancouver, BC",
    "montreal area": "Montreal, QC",
    "ottawa region": "Ottawa, ON",
  };

  if (/^remote(\s*\(?\s*canada\s*\)?)?$/i.test(text) || /^canada(\s*only)?$/i.test(text)) {
    return "Remote (Canada)";
  }
  if (/remote/i.test(text) && /canada/i.test(text)) return "Remote (Canada)";
  if (/^remote\b/i.test(text)) return "Remote";

  const lower = text.toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ").trim();
  if (REGION_TO_CITY[lower]) return REGION_TO_CITY[lower];
  if (CITY_DEFAULTS[lower]) return CITY_DEFAULTS[lower];
  if (PROVINCE_CODES[lower]) return PROVINCE_CODES[lower];

  const cityProv =
    text.match(/^([A-Za-zÀ-ÿ .'-]+?)\s*,\s*([A-Za-z .]+)$/) ||
    text.match(
      /^([A-Za-zÀ-ÿ .'-]+?)\s+(Ontario|Quebec|British Columbia|Alberta|Manitoba|Saskatchewan|ON|QC|BC|AB|MB|SK)\s*$/i,
    );
  if (cityProv) {
    const cityRaw = cityProv[1].trim();
    const provRaw = cityProv[2].trim().toLowerCase();
    const code =
      PROVINCE_CODES[provRaw] || (/^[a-z]{2}$/i.test(provRaw) ? provRaw.toUpperCase() : null);
    const cityKey = cityRaw.toLowerCase();
    if (CITY_DEFAULTS[cityKey]) return CITY_DEFAULTS[cityKey];
    if (code) {
      const titled = cityRaw
        .split(/\s+/)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join(" ");
      return `${titled}, ${code}`;
    }
  }

  for (const [city, formatted] of Object.entries(CITY_DEFAULTS)) {
    if (lower.includes(city)) return formatted;
  }
  for (const [region, formatted] of Object.entries(REGION_TO_CITY)) {
    if (lower.includes(region)) return formatted;
  }

  text = text.replace(/,?\s*canada\s*$/i, "").trim();
  if (!text) return "Remote (Canada)";
  if (/^(ontario|quebec|british columbia|alberta|canada|gta)$/i.test(text)) {
    return PROVINCE_CODES[text.toLowerCase()] || "Remote (Canada)";
  }
  return text;
}

function normalizeLinkedInJob(item) {
  const title = String(item.title || item.jobTitle || item.position || "").trim();
  const location = sanitizeRoleLocation(
    item.location || item.jobLocation || item.formattedLocation || item.place || "Remote (Canada)",
  );
  const company = String(
    item.companyName ||
      item.company ||
      item.company_name ||
      item.employer ||
      item.organization ||
      item.hiringCompany ||
      "",
  ).trim();
  const rawUrl = String(
    item.applyUrl ||
      item.apply_url ||
      item.jobUrl ||
      item.url ||
      item.link ||
      item.externalApplyUrl ||
      "",
  ).trim();
  // Never invent / keep contaminated URLs (e.g. Tim Hortons Restaurant Manager).
  const apply_url = isUsableJobUrl(rawUrl) ? rawUrl : null;
  const posted_date = parseJobPostedDate(
    item.postedAt ||
      item.posted_date ||
      item.postedDate ||
      item.publishedAt ||
      item.datePosted ||
      item.listedAt ||
      item.postedTime ||
      item.postedAgo,
  );
  if (!title) return null;
  return { title, location, posted_date, apply_url, company };
}

function isFreshJob(job) {
  if (!job?.posted_date) return true; // keep undated listings; LinkedIn guest often omits exact dates
  return job.posted_date >= daysAgoIso(JOB_FRESHNESS_DAYS);
}

function hiringSignalFromCount(count) {
  if (count <= 0) return "No Active Roles";
  if (count <= 5) return `Hiring ${count} Core Roles`;
  return `High Growth: ${count}+ Open Roles`;
}

/** Contaminated / example URLs that must never be stored as role apply links. */
const CONTAMINATED_JOB_URL_RE =
  /tim[-_]?hortons|mcdonald'?s|starbucks|walmart|loblaw|subway\.com|burger.?king|restaurant[-_]?manager|indeed\.com\/cmp\/tim/i;
const EXAMPLE_JOB_URL_RE =
  /linkedin\.com\/jobs\/view\/(northstar|kitepath|harbourgrid|maplestack)|example\.com|placeholder|javascript:void/i;

function isContaminatedJobUrl(url) {
  if (!url) return false;
  const text = String(url);
  return CONTAMINATED_JOB_URL_RE.test(text) || EXAMPLE_JOB_URL_RE.test(text);
}

function isUsableJobUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return false;
  if (!/^https?:\/\//i.test(raw)) return false;
  if (isContaminatedJobUrl(raw)) return false;
  return true;
}

function resolveRoleApplyUrl(rawUrl, careersUrl) {
  if (isUsableJobUrl(rawUrl)) return String(rawUrl).trim();
  if (isUsableJobUrl(careersUrl)) return String(careersUrl).trim();
  return null;
}

function jobBelongsToCompany(job, companyName) {
  const brand = String(companyName || "").trim().toLowerCase();
  if (!brand) return false;
  const url = String(job.apply_url || job.url || "");
  if (isContaminatedJobUrl(url)) return false;

  const listedCompany = String(job.company || "").trim().toLowerCase();
  if (listedCompany) {
    if (listedCompany.includes(brand) || brand.includes(listedCompany)) return true;
    const tokens = brand.split(/\s+/).filter((t) => t.length > 2);
    if (tokens.length && tokens.every((t) => listedCompany.includes(t))) return true;
    return false;
  }
  return isUsableJobUrl(url) || !url;
}

function peerRolesFromJobs(jobs, careersUrl) {
  return jobs.slice(0, 15).map((job) => {
    const url = resolveRoleApplyUrl(job.apply_url, careersUrl);
    return {
      title: job.title,
      location: sanitizeRoleLocation(job.location),
      url, // may be null — UI should fall back to company careers
      posted_at: job.posted_date || null,
    };
  });
}

/** Latest posted_at across peer/open roles → company.freshness (YYYY-MM-DD). */
function aggregateCompanyFreshness(peerRoles) {
  if (!Array.isArray(peerRoles) || peerRoles.length === 0) return null;
  let latest = null;
  for (const role of peerRoles) {
    const date = parseJobPostedDate(role.posted_at || role.postedAt || role.posted_date);
    if (!date) continue;
    if (!latest || date > latest) latest = date;
  }
  return latest;
}

async function fetchLinkedInJobsForCompany(client, companyName) {
  const meta = LINKEDIN_COMPANY_MAP[companyName] || {};
  const linkedinUrlCandidates = getLinkedInUrlCandidates(companyName, meta.careers_url);
  const cleanName = String(companyName || "").trim();

  const actors = [LINKEDIN_JOBS_ACTOR, ...LINKEDIN_JOBS_FALLBACK_ACTORS].filter(
    (id, index, list) => list.indexOf(id) === index,
  );

  for (const actorId of actors) {
    try {
      console.log(`[LinkedIn] Fetching Canada jobs for ${cleanName} via ${actorId}…`);
      console.log(
        `[LinkedIn] Slug candidates: ${linkedInSlugCandidates(cleanName).join(" | ") || "(none)"}`,
      );
      let input;
      if (actorId.includes("curious_coder/linkedin-jobs-scraper")) {
        // Primary: LinkedIn internal name search via company/keywords — NOT hardcoded slug URLs.
        // Slug candidate URLs are soft fallbacks only (merged → hyphenated → suffix expansions).
        input = {
          company: cleanName,
          keywords: cleanName,
          location: "Canada",
          count: 20,
          urls: [
            `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(cleanName)}&location=Canada`,
          ],
          // Soft URL fallbacks — do not rely on these for resolution.
          companyUrls: linkedinUrlCandidates.slice(0, 6),
        };
      } else if (actorId.includes("bebity/linkedin-jobs-scraper")) {
        input = {
          keywords: cleanName,
          company: cleanName,
          location: "Canada",
          count: 20,
        };
      } else if (actorId.includes("api-empire/linkedin-search-jobs-scraper")) {
        input = {
          startUrls: [
            `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(cleanName)}&location=Canada`,
            ...linkedinUrlCandidates,
            `${cleanName}, Canada`,
          ],
          sortOrder: "recent",
          maxJobs: 20,
        };
      } else if (actorId.includes("scrapapi/linkedin-jobs-scraper")) {
        input = {
          companyInput: [cleanName, ...linkedinUrlCandidates],
          keywords: cleanName,
          location: "Canada",
          maxItems: 20,
        };
      } else {
        input = {
          company: cleanName,
          keywords: cleanName,
          companyUrls: linkedinUrlCandidates,
          locations: ["Canada"],
          maxJobs: 20,
          postedSince: "1m",
        };
      }

      const run = await client.actor(actorId).call(input, { waitSecs: 240 });
      if (!run?.defaultDatasetId) continue;
      const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 50 });
      const jobs = (items || [])
        .map(normalizeLinkedInJob)
        .filter(Boolean)
        .filter(isFreshJob)
        .filter((job) => jobBelongsToCompany(job, cleanName));
      const dropped = (items || []).length - jobs.length;
      if (dropped > 0) {
        console.log(
          `[LinkedIn] ${cleanName}: dropped ${dropped} unrelated/contaminated listings (e.g. wrong employer URLs).`,
        );
      }
      console.log(`[LinkedIn] ${cleanName}: ${jobs.length} fresh jobs (<= ${JOB_FRESHNESS_DAYS}d).`);
      return jobs;
    } catch (error) {
      const message = error?.message || String(error);
      console.warn(`[LinkedIn] ${cleanName} via ${actorId} failed: ${message}`);
      if (/rate limit|too many requests|429/i.test(message)) {
        console.warn(`[LinkedIn] Rate limit hit for ${cleanName}; using careers fallback.`);
        return [];
      }
    }
  }
  return [];
}

async function enrichOneCompany(client, company) {
  const brandName = cleanCompanyName(company.name) || company.name;
  const meta =
    LINKEDIN_COMPANY_MAP[brandName] ||
    LINKEDIN_COMPANY_MAP[company.name] ||
    {};
  const candidateCareers =
    meta.careers_url ||
    (company.apply_url && !/linkedin\.com\/jobs\/view/i.test(String(company.apply_url))
      ? company.apply_url
      : null);

  let jobs = [];
  try {
    jobs = await fetchAtsJobsFromCareersUrl(candidateCareers, brandName);
  } catch (error) {
    console.warn(`[ATS] Enrichment failed for ${brandName}:`, error.message || error);
    jobs = [];
  }

  if (jobs.length === 0) {
    try {
      jobs = await fetchLinkedInJobsForCompany(client, brandName);
    } catch (error) {
      console.warn(`[LinkedIn] Enrichment failed for ${brandName}:`, error.message || error);
      jobs = [];
    }
  }

  const hiring_signal = hiringSignalFromCount(jobs.length);
  const careersFallback =
    candidateCareers && !/linkedin\.com\/jobs\/view/i.test(String(candidateCareers))
      ? candidateCareers
      : meta.careers_url || null;
  const peer_roles = peerRolesFromJobs(jobs, careersFallback);
  const freshness = aggregateCompanyFreshness(peer_roles);
  const apply_url =
    (candidateCareers && looksLikeAtsCareersUrl(candidateCareers) ? candidateCareers : null) ||
    candidateCareers ||
    null;
  if (candidateCareers && looksLikeAtsCareersUrl(candidateCareers)) {
    console.log(`[ATS] ${brandName}: careers board detected → ${apply_url}`);
  }
  if (freshness) {
    console.log(`[Freshness] ${brandName}: latest role posted_at → ${freshness}`);
  }

  const enrichedRow = withRequiredLinkedInUrl({
    ...company,
    name: brandName,
    linkedin_url: getLinkedInUrl(brandName, meta.careers_url || company.domain),
    apply_url,
    hiring_signal,
    peer_roles,
    open_role_count: jobs.length,
    freshness,
  });
  const radar_data = calculateRadarScores(enrichedRow);
  const withRadar = {
    ...enrichedRow,
    radar_data,
    surge_index: surgeFromRadar(radar_data),
  };
  return {
    ...withRadar,
    is_active: computeIsActive(withRadar),
  };
}

async function enrichWithLinkedInJobs(apifyToken, companies) {
  const client = new ApifyClient({ token: apifyToken });
  const enriched = [];
  const batchSize = LINKEDIN_ENRICH_BATCH_SIZE;

  for (let i = 0; i < companies.length; i += batchSize) {
    const batch = companies.slice(i, i + batchSize);
    const wave = Math.floor(i / batchSize) + 1;
    console.log(
      `[LinkedIn/ATS] Batch ${wave}: enriching ${batch.map((c) => c.name).join(", ")} (${batch.length} parallel)…`,
    );

    const results = await Promise.allSettled(
      batch.map((company) => enrichOneCompany(client, company)),
    );

    for (let j = 0; j < results.length; j += 1) {
      const result = results[j];
      const company = batch[j];
      if (result.status === "fulfilled" && result.value) {
        enriched.push(result.value);
        continue;
      }
      const reason = result.status === "rejected" ? result.reason : "empty result";
      console.warn(
        `[LinkedIn/ATS] Batch item failed for ${company.name}:`,
        reason?.message || reason,
      );
      const fallback = withRequiredLinkedInUrl({
        ...company,
        name: cleanCompanyName(company.name) || company.name,
        hiring_signal: company.hiring_signal || "No Active Roles",
        peer_roles: company.peer_roles || [],
        open_role_count: Number(company.open_role_count) || 0,
      });
      enriched.push({
        ...fallback,
        is_active: computeIsActive(fallback),
      });
    }
  }

  return enriched;
}

function printUpsertPreview(companies) {
  const preview = companies.map((row) => ({
    name: row.name,
    linkedin_url: row.linkedin_url,
    apply_url: row.apply_url,
    hiring_signal: row.hiring_signal,
    open_role_count: row.open_role_count,
    peer_roles: row.peer_roles,
    is_active: row.is_active,
    funding_date: row.funding_date,
    industry: row.industry,
    tagline: row.tagline,
  }));
  console.log("\n========== SANDBOX UPSERT PREVIEW (Cohere / Waabi) ==========");
  console.log(JSON.stringify(preview, null, 2));
  console.log("==============================================================\n");
}

function dedupeCompanies(rows) {
  const byName = new Map();
  for (const row of rows) {
    const key = row.name.toLowerCase();
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, row);
      continue;
    }
    const preferNewer =
      (row.funding_date || "") >= (existing.funding_date || "") ? row : existing;
    const other = preferNewer === row ? existing : row;
    const radar_data = {
      growth: Math.max(preferNewer.radar_data.growth, other.radar_data.growth),
      product: Math.max(preferNewer.radar_data.product, other.radar_data.product),
      market: Math.max(preferNewer.radar_data.market, other.radar_data.market),
      leadership: Math.max(preferNewer.radar_data.leadership, other.radar_data.leadership),
      culture: Math.max(preferNewer.radar_data.culture, other.radar_data.culture),
      capital: Math.max(preferNewer.radar_data.capital, other.radar_data.capital),
    };
    const merged = {
      ...preferNewer,
      lead_investor:
        preferNewer.lead_investor !== "Undisclosed"
          ? preferNewer.lead_investor
          : other.lead_investor,
      funding_amount: preferNewer.funding_amount || other.funding_amount,
      funding_round: preferNewer.funding_round || other.funding_round,
      industry:
        preferNewer.industry && preferNewer.industry !== "B2B SaaS" && preferNewer.industry !== "Others"
          ? preferNewer.industry
          : other.industry || preferNewer.industry,
      open_role_count: Math.max(
        Number(preferNewer.open_role_count) || 0,
        Number(other.open_role_count) || 0,
      ),
      peer_roles:
        (preferNewer.peer_roles?.length || 0) >= (other.peer_roles?.length || 0)
          ? preferNewer.peer_roles
          : other.peer_roles,
      radar_data,
      surge_index: surgeFromRadar(radar_data),
    };
    byName.set(key, {
      ...merged,
      is_active: computeIsActive(merged) || Boolean(preferNewer.is_active) || Boolean(other.is_active),
    });
  }
  return [...byName.values()];
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
      if (!run?.defaultDatasetId) throw new Error("Apify run finished without a dataset id.");
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

async function mapItemsWithOpenAI(openai, items) {
  const rows = [];
  let index = 0;
  for (const item of items) {
    index += 1;
    try {
      const extracted = await extractWithOpenAI(openai, item);
      const row = toCompanyRow(extracted, item);
      if (row) {
        rows.push(row);
        console.log(
          `[${index}/${items.length}] ${row.name}` +
            (row.is_active ? " · active" : " · delisted") +
            (row.lead_investor !== "Undisclosed" ? ` · ${row.lead_investor}` : ""),
        );
      } else {
        console.log(`[${index}/${items.length}] skipped (invalid / non-company news)`);
      }
    } catch (error) {
      console.warn(`[${index}/${items.length}] OpenAI extraction failed:`, error.message || error);
    }
  }
  return rows;
}

async function upsertCompanies(supabase, cleanCompanies) {
  // Resolve existing UUIDs by name so upserts update in place instead of nulling id.
  const names = [
    ...new Set(
      (cleanCompanies || [])
        .map((row) => String(row.name || "").trim())
        .filter(Boolean),
    ),
  ];
  const existingIdByName = new Map();
  if (names.length) {
    const { data: existing, error: lookupError } = await supabase
      .from("companies")
      .select("id,name")
      .in("name", names);
    if (lookupError) {
      console.warn("[Upsert] Could not preload company ids:", lookupError.message || lookupError);
    } else {
      for (const row of existing || []) {
        const key = String(row.name || "").trim().toLowerCase();
        if (key && isValidUuid(row.id)) existingIdByName.set(key, row.id);
      }
    }
  }

  let payload = cleanCompanies.map((row) =>
    ensureCompanyRowId(withRequiredLinkedInUrl(row), existingIdByName),
  );

  const missingIds = payload.filter((row) => !isValidUuid(row.id));
  if (missingIds.length) {
    throw new Error(
      `companies.id missing for: ${missingIds.map((r) => r.name).join(", ")}`,
    );
  }

  for (let attempt = 0; attempt < 24; attempt += 1) {
    // Prefer keeping linkedin_url; only drop it if the column truly does not exist.
    const { error } = await supabase.from("companies").upsert(payload, {
      onConflict: "name",
    });
    if (!error) {
      const missingUrl = payload.filter((row) => !row.linkedin_url);
      if (missingUrl.length) {
        throw new Error(`linkedin_url missing for: ${missingUrl.map((r) => r.name).join(", ")}`);
      }
      return;
    }
    const missing = error.message?.match(/Could not find the '([^']+)' column/i);
    if (missing?.[1]) {
      const column = missing[1];
      console.warn(`Dropping unsupported column "${column}" and retrying upsert.`);
      if (column === "linkedin_url") {
        console.warn(
          "Supabase is missing companies.linkedin_url — add a text column so LinkedIn URLs can persist.",
        );
      }
      if (column === "id") {
        // Should not drop id when the column exists and is NOT NULL — regenerate instead.
        payload = payload.map((row) => ensureCompanyRowId(row, existingIdByName));
        continue;
      }
      payload = payload.map((row) => {
        const next = ensureCompanyRowId(withRequiredLinkedInUrl(row), existingIdByName);
        delete next[column];
        return next;
      });
      continue;
    }
    if (/on conflict|unique|no unique or exclusion constraint/i.test(error.message || "")) {
      console.warn("No unique constraint on name; falling back to insert.");
      const { error: insertError } = await supabase.from("companies").insert(payload);
      if (!insertError) return;
      throw insertError;
    }
    throw error;
  }
  throw new Error("Could not upsert companies after dropping unknown columns.");
}

/**
 * Seed row for an anchor company when it is missing from the fresh scrape.
 */
function buildAnchorCompanyRow(name) {
  const meta =
    LINKEDIN_COMPANY_MAP[name] ||
    Object.entries(LINKEDIN_COMPANY_MAP).find(
      ([key]) => key.toLowerCase() === name.toLowerCase(),
    )?.[1];
  if (!meta) {
    const base = {
      id: randomUUID(),
      name,
      tagline: "Canadian tech company.",
      mission: "Canadian tech company.",
      funding_date: null,
      funding_round: null,
      funding_amount: null,
      industry: "Others",
      hq_city: null,
      location_region: "Others",
      location: "Others",
      lead_investor: "Undisclosed",
      peer_roles: [],
      open_role_count: 0,
      linkedin_url: getLinkedInUrl(name),
    };
    const radar_data = calculateRadarScores(base);
    return {
      ...base,
      radar_data,
      surge_index: surgeFromRadar(radar_data),
      is_active: computeIsActive(base),
    };
  }
  const base = {
    id: randomUUID(),
    name,
    tagline: meta.tagline,
    mission: meta.tagline,
    funding_date: meta.funding_date,
    funding_round: meta.funding_round,
    funding_amount: meta.funding_amount,
    industry: meta.industry,
    hq_city: meta.hq_city,
    location_region: meta.location_region,
    location: `${meta.hq_city} · ${meta.location_region}`,
    lead_investor: meta.lead_investor,
    headcount: "51-200",
    linkedin_url: getLinkedInUrl(name, meta.careers_url),
    apply_url: meta.careers_url,
    hiring_signal: "No Active Roles",
    peer_roles: [],
    open_role_count: 0,
  };
  const radar_data = calculateRadarScores(base);
  const withRadar = {
    ...base,
    radar_data,
    surge_index: surgeFromRadar(radar_data),
  };
  return {
    ...withRadar,
    is_active: computeIsActive(withRadar),
  };
}

/**
 * Ensure every ANCHOR_COMPANY is present in the upsert batch.
 * Prefer existing Supabase row data when available; otherwise seed from LINKEDIN_COMPANY_MAP.
 */
async function mergeAnchorCompaniesForUpsert(supabase, cleanCompanies) {
  const byName = new Map(
    (cleanCompanies || []).map((row) => [String(row.name || "").trim().toLowerCase(), row]),
  );

  const { data: existing, error } = await supabase
    .from("companies")
    .select("*")
    .in("name", ANCHOR_COMPANIES);
  if (error) {
    console.warn("[Anchors] Could not load existing anchors:", error.message || error);
  }
  const existingByName = new Map(
    (existing || []).map((row) => [String(row.name || "").trim().toLowerCase(), row]),
  );

  let added = 0;
  for (const anchor of ANCHOR_COMPANIES) {
    const key = anchor.toLowerCase();
    if (byName.has(key)) continue;

    const dbRow = existingByName.get(key);
    if (dbRow) {
      // Keep the live DB row (and its UUID); never wipe anchors.
      byName.set(
        key,
        ensureCompanyRowId(
          withRequiredLinkedInUrl({
            ...dbRow,
            name: dbRow.name || anchor,
            id: dbRow.id,
            is_active: computeIsActive(dbRow),
          }),
        ),
      );
      added += 1;
      console.log(`[Anchors] Preserving existing DB row: ${dbRow.name || anchor}`);
      continue;
    }

    const seeded = ensureCompanyRowId(buildAnchorCompanyRow(anchor));
    byName.set(key, seeded);
    added += 1;
    console.log(`[Anchors] Seeding missing anchor: ${anchor} (id=${seeded.id})`);
  }

  // Also attach DB ids onto scrape-batch anchors that arrived without one.
  for (const [key, row] of byName) {
    if (isValidUuid(row.id)) continue;
    const dbRow = existingByName.get(key);
    byName.set(
      key,
      ensureCompanyRowId(row, new Map(dbRow?.id ? [[key, dbRow.id]] : [])),
    );
  }

  if (added === 0) {
    console.log("[Anchors] All permanent anchors already present in scrape batch.");
  }
  return [...byName.values()];
}

async function scrubContaminatedPeerRoleUrls(supabase) {
  const { data, error } = await supabase.from("companies").select("id,name,apply_url,peer_roles");
  if (error) {
    console.warn("[URL scrub] Could not list companies:", error.message || error);
    return 0;
  }
  let updated = 0;
  for (const row of data || []) {
    if (!Array.isArray(row.peer_roles) || row.peer_roles.length === 0) {
      if (isContaminatedJobUrl(row.apply_url)) {
        await supabase.from("companies").update({ apply_url: null }).eq("id", row.id);
        updated += 1;
      }
      continue;
    }
    const careers =
      row.apply_url && !isContaminatedJobUrl(row.apply_url) ? row.apply_url : null;
    let changed = false;
    const nextRoles = row.peer_roles.map((role) => {
      const url = role?.url || role?.apply_url || role?.job_url;
      if (!isContaminatedJobUrl(url) && isUsableJobUrl(url)) return role;
      if (!url && !role?.url) return role;
      if (isContaminatedJobUrl(url) || (url && !isUsableJobUrl(url))) {
        changed = true;
        return { ...role, url: careers || null };
      }
      return role;
    });
    const patch = {};
    if (changed) patch.peer_roles = nextRoles;
    if (isContaminatedJobUrl(row.apply_url)) patch.apply_url = null;
    if (!Object.keys(patch).length) continue;
    const { error: updError } = await supabase.from("companies").update(patch).eq("id", row.id);
    if (!updError) {
      updated += 1;
      console.log(`[URL scrub] Cleaned contaminated role URLs for ${row.name}`);
    }
  }
  if (updated === 0) console.log("[URL scrub] No contaminated role URLs found.");
  return updated;
}

/**
 * Delete blacklisted global giants (e.g. Nvidia) and any associated role-shaped JSON.
 */
async function deleteBlacklistedGiants(supabase) {
  const names = [...new Set(GLOBAL_GIANTS_BLACKLIST)];
  console.log(`[Blacklist] Removing giants from Supabase: ${names.join(", ")}`);

  const { data: existing, error: listError } = await supabase
    .from("companies")
    .select("id,name")
    .in("name", names);
  if (listError) {
    // Case-insensitive fallback: fetch all names and filter locally.
    const all = await supabase.from("companies").select("id,name");
    if (all.error) {
      console.warn("[Blacklist] Could not list companies:", all.error.message || all.error);
      return 0;
    }
    const matched = (all.data || []).filter((row) => isBlacklistedGiant(row.name));
    if (!matched.length) {
      console.log("[Blacklist] No blacklisted rows found.");
      return 0;
    }
    const ids = matched.map((r) => r.id).filter(Boolean);
    const matchedNames = matched.map((r) => r.name);
    if (ids.length) {
      await supabase.from("companies").delete().in("id", ids);
    } else {
      await supabase.from("companies").delete().in("name", matchedNames);
    }
    // Best-effort: clear related saved-job style tables if present.
    for (const table of ["roles", "company_roles", "open_roles", "user_saved_jobs"]) {
      const del = await supabase.from(table).delete().in("company_name", matchedNames);
      if (del.error) {
        await supabase.from(table).delete().in("company_id", ids);
      }
    }
    console.log(`[Blacklist] Deleted ${matched.length} giant row(s): ${matchedNames.join(", ")}`);
    return matched.length;
  }

  const rows = existing || [];
  // Also catch case variants not in exact .in() list
  const all = await supabase.from("companies").select("id,name");
  const extra = (all.data || []).filter(
    (row) => isBlacklistedGiant(row.name) && !rows.some((r) => r.id === row.id),
  );
  const toDelete = [...rows, ...extra];
  if (!toDelete.length) {
    console.log("[Blacklist] No blacklisted rows found.");
    return 0;
  }

  const ids = toDelete.map((r) => r.id).filter(Boolean);
  const matchedNames = toDelete.map((r) => r.name);
  if (ids.length) {
    const { error } = await supabase.from("companies").delete().in("id", ids);
    if (error) {
      await supabase.from("companies").delete().in("name", matchedNames);
    }
  } else {
    await supabase.from("companies").delete().in("name", matchedNames);
  }
  console.log(`[Blacklist] Deleted ${toDelete.length} giant row(s): ${matchedNames.join(", ")}`);
  return toDelete.length;
}
async function wipeStaleGarbageEntities(supabase, keepCompanies) {
  const keep = new Set(
    (keepCompanies || []).map((row) => String(row.name || "").trim().toLowerCase()).filter(Boolean),
  );
  for (const anchor of ANCHOR_COMPANIES) {
    keep.add(anchor.toLowerCase());
  }

  const { data, error } = await supabase.from("companies").select("id,name");
  if (error) {
    console.warn("[Cleanup] Could not list companies for garbage wipe:", error.message || error);
    return 0;
  }

  const stale = (data || []).filter((row) => {
    const name = String(row.name || "").trim();
    if (!name) return false;
    if (isAnchorCompany(name)) return false;
    if (keep.has(name.toLowerCase())) return false;
    return isGarbageEntityName(name);
  });

  if (stale.length === 0) {
    console.log("[Cleanup] No stale garbage entities to wipe.");
    return 0;
  }

  const ids = stale.map((row) => row.id).filter(Boolean);
  const names = stale.map((row) => row.name);
  console.log(
    `[Cleanup] Wiping ${stale.length} garbage rows: ${names.slice(0, 12).join(", ")}${names.length > 12 ? "…" : ""}`,
  );

  if (ids.length) {
    const { error: delById } = await supabase.from("companies").delete().in("id", ids);
    if (!delById) return stale.length;
    console.warn("[Cleanup] Delete by id failed, trying by name:", delById.message || delById);
  }

  const { error: delByName } = await supabase.from("companies").delete().in("name", names);
  if (delByName) {
    console.warn("[Cleanup] Delete by name failed:", delByName.message || delByName);
    return 0;
  }
  return stale.length;
}

async function main() {
  const token = requireEnv("APIFY_API_TOKEN");
  const openaiKey = requireEnv("OPENAI_API_KEY");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const openai = createOpenAIClient(openaiKey);

  console.log("Env debug (present/absent, values hidden):", {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    APIFY_API_TOKEN: Boolean(process.env.APIFY_API_TOKEN),
    OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    SANDBOX_TEST_MODE,
    TEST_COMPANIES,
  });

  let cleanCompanies = [];

  if (SANDBOX_TEST_MODE) {
    console.log(
      `[SANDBOX] Strict test mode ON — only processing: ${TEST_COMPANIES.join(", ")}`,
    );
    // Skip broad news/OpenAI burn: seed only Cohere + Waabi, then enrich via LinkedIn jobs.
    cleanCompanies = buildSandboxCompanyRows();
  } else {
    const items = await fetchNews(token);
    console.log(`Extracting companies from ${items.length} articles with ${LLM_MODEL}…`);
    cleanCompanies = dedupeCompanies(await mapItemsWithOpenAI(openai, items));
  }

  if (cleanCompanies.length === 0) {
    console.log("No clean company rows parsed; leaving Supabase unchanged.");
    return;
  }

  // Always keep sandbox limited to TEST_COMPANIES even if news path is used later.
  if (SANDBOX_TEST_MODE) {
    cleanCompanies = cleanCompanies.filter((row) =>
      TEST_COMPANIES.some((name) => name.toLowerCase() === row.name.toLowerCase()),
    );
  }

  // LinkedIn / ATS role enrichment (disable with ENABLE_LINKEDIN_JOBS=0).
  const enableLinkedInJobs =
    SANDBOX_TEST_MODE || process.env.ENABLE_LINKEDIN_JOBS !== "0";
  if (enableLinkedInJobs) {
    console.log(`[LinkedIn/ATS] Enriching ${cleanCompanies.length} companies with live jobs…`);
    cleanCompanies = await enrichWithLinkedInJobs(token, cleanCompanies);
  } else {
    console.log("[LinkedIn/ATS] Skipped (ENABLE_LINKEDIN_JOBS=0).");
  }

  if (SANDBOX_TEST_MODE) {
    printUpsertPreview(cleanCompanies);
  }

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const cleanedUrl = rawUrl.trim().replace(/^["']|["']$/g, "");
  if (!cleanedUrl) {
    console.error("❌ CRITICAL: Supabase URL is missing from process.env!");
    process.exit(1);
  }

  const supabase = createClient(cleanedUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Remove Nvidia / global giants immediately (never keep in DB).
  await deleteBlacklistedGiants(supabase);

  // Scrub Tim Hortons / contaminated role URLs from peer_roles before upsert overwrite.
  await scrubContaminatedPeerRoleUrls(supabase);

  cleanCompanies = cleanCompanies.filter((row) => !isBlacklistedGiant(row.name));

  // Anchor protection: always re-include Cohere/Waabi/TransCrypts/Haply/Simuhealth/Taalas.
  cleanCompanies = await mergeAnchorCompaniesForUpsert(supabase, cleanCompanies);

  // Wipe stale headline/garbage entities (anchors never deleted).
  const wiped = await wipeStaleGarbageEntities(supabase, cleanCompanies);
  await upsertCompanies(supabase, cleanCompanies);

  const activeCount = cleanCompanies.filter((row) => row.is_active).length;
  console.log(
    `Upserted ${cleanCompanies.length} companies onConflict=name (${activeCount} active; wiped ${wiped} garbage; anchors=${ANCHOR_COMPANIES.length}).`,
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
