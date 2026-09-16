import type { Company, PeerRole, RadarData } from "./types";

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
  "lightsail",
  "tiger global",
  "coatue",
  "insight partners",
  "gv",
  "google ventures",
  "founders fund",
  "khosla",
  "omidyar",
  "radical ventures",
  "version one",
];

function hashSeed(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function jitter(seed: number, lane: number, min: number, max: number) {
  if (max <= min) return min;
  const unit = ((seed >>> (lane % 24)) ^ Math.imul(seed, lane + 11)) >>> 0;
  const t = (unit % 1000) / 999;
  return Math.round(min + t * (max - min));
}

function clampScore(n: number) {
  return Math.max(50, Math.min(98, Math.round(n)));
}

function parseFundingMillions(amount: string | null | undefined) {
  if (!amount) return 0;
  const text = amount.replace(/,/g, "").trim().toUpperCase();
  const match = text.match(/([\d.]+)\s*([MBK])?/);
  if (!match) return 0;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return 0;
  const unit = match[2] || "";
  if (unit === "B") return value * 1000;
  if (unit === "M") return value;
  if (unit === "K") return value / 1000;
  return value;
}

function openRoleCount(company: {
  openRoleCount?: number;
  peerRoles?: PeerRole[] | null;
  hiringSignal?: string | null;
}) {
  if (typeof company.openRoleCount === "number" && company.openRoleCount > 0) {
    return company.openRoleCount;
  }
  const signal = company.hiringSignal || "";
  const fromSignal = signal.match(/(\d+)\+?/);
  if (fromSignal) return Number(fromSignal[1]);
  return company.peerRoles?.length ?? 0;
}

function parseHeadcount(headcount: string | undefined) {
  if (!headcount) return 40;
  const plus = headcount.match(/(\d+)\+/);
  if (plus) return Number(plus[1]) + 50;
  const range = headcount.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2);
  const single = headcount.match(/(\d+)/);
  return single ? Number(single[1]) : 40;
}

function departmentDiversity(roles: PeerRole[] | null | undefined) {
  if (!roles?.length) return 0;
  const buckets = new Set<string>();
  for (const role of roles) {
    const title = role.title.toLowerCase();
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

function fundingFreshnessBoost(fundingDate: string | null | undefined) {
  if (!fundingDate) return 0;
  const funded = new Date(`${fundingDate}T00:00:00Z`);
  if (Number.isNaN(funded.getTime())) return 0;
  const days = Math.max(0, Math.round((Date.now() - funded.getTime()) / 86400000));
  if (days <= 30) return 12;
  if (days <= 90) return 8;
  if (days <= 180) return 4;
  return 0;
}

function scoreGrowth(roles: number, seed: number) {
  if (roles > 20) return jitter(seed, 1, 92, 98);
  if (roles >= 10) return jitter(seed, 1, 80, 90);
  if (roles >= 5) return jitter(seed, 1, 75, 85);
  if (roles > 0) return jitter(seed, 1, 65, 75);
  return jitter(seed, 1, 55, 68);
}

function scoreCapital(round: string, amount: string | null | undefined, seed: number) {
  const millions = parseFundingMillions(amount);
  const stage = (round || "").toLowerCase();
  if (stage.includes("series d") || stage.includes("series e") || millions >= 250) {
    return jitter(seed, 2, 90, 98);
  }
  if (stage.includes("series c") || millions >= 80) return jitter(seed, 2, 86, 94);
  if (stage.includes("series b") || millions >= 30) return jitter(seed, 2, 80, 90);
  if (stage.includes("series a") || millions >= 8) return jitter(seed, 2, 75, 85);
  if (stage.includes("seed") || stage.includes("pre")) return jitter(seed, 2, 60, 72);
  return jitter(seed, 2, 62, 78);
}

function scoreMarket(headcount: string | undefined, roles: PeerRole[] | null | undefined, seed: number) {
  const size = parseHeadcount(headcount);
  const diversity = departmentDiversity(roles);
  let base = 62;
  if (size >= 200) base = 88;
  else if (size >= 100) base = 82;
  else if (size >= 50) base = 76;
  else if (size >= 20) base = 70;
  base += Math.min(10, diversity * 2);
  return clampScore(jitter(seed, 3, base - 3, base + 4));
}

function scoreLeadership(leadInvestor: string | null | undefined, seed: number) {
  const text = (leadInvestor || "").toLowerCase();
  const tier1 = TIER1_INVESTORS.some((name) => text.includes(name));
  if (tier1) return jitter(seed, 4, 86, 96);
  if (text && text !== "undisclosed") return jitter(seed, 4, 74, 86);
  return jitter(seed, 4, 62, 74);
}

function scoreProduct(
  industry: string | undefined,
  roles: number,
  seed: number,
) {
  const sector = (industry || "").toLowerCase();
  let lo = 68;
  let hi = 80;
  if (/ai|data|ml|machine/.test(sector)) {
    lo = 82;
    hi = 94;
  } else if (/fintech|finance|pay/.test(sector)) {
    lo = 78;
    hi = 90;
  } else if (/hardware|robot|autonom|cleantech|energy/.test(sector)) {
    lo = 80;
    hi = 92;
  } else if (/saas|b2b|software/.test(sector)) {
    lo = 74;
    hi = 88;
  }
  if (roles >= 10) {
    lo += 2;
    hi = Math.min(98, hi + 3);
  }
  return jitter(seed, 5, lo, hi);
}

function scoreCulture(
  fundingDate: string | null | undefined,
  roles: number,
  seed: number,
) {
  const freshness = fundingFreshnessBoost(fundingDate);
  let lo = 62 + Math.min(10, Math.floor(roles / 2));
  let hi = lo + 10;
  lo += Math.floor(freshness / 2);
  hi += freshness;
  return clampScore(jitter(seed, 6, lo, hi));
}

export type RadarScoreInput = {
  name: string;
  industry?: string;
  fundingRound?: string;
  fundingAmount?: string | null;
  fundingDate?: string | null;
  leadInvestor?: string | null;
  headcount?: string;
  openRoleCount?: number;
  hiringSignal?: string | null;
  peerRoles?: PeerRole[] | null;
};

export function calculateRadarScores(company: RadarScoreInput | Company): RadarData {
  const seed = hashSeed(
    [
      company.name,
      company.industry || "",
      company.fundingRound || "",
      company.fundingAmount || "",
      company.fundingDate || "",
      company.leadInvestor || "",
      String(openRoleCount(company)),
    ].join("|"),
  );
  const roles = openRoleCount(company);
  const peerRoles = "peerRoles" in company ? company.peerRoles : null;

  const radar: RadarData = {
    growth: clampScore(scoreGrowth(roles, seed)),
    capital: clampScore(
      scoreCapital(
        "fundingRound" in company ? company.fundingRound || "" : "",
        "fundingAmount" in company ? company.fundingAmount : null,
        seed,
      ),
    ),
    market: clampScore(
      scoreMarket("headcount" in company ? company.headcount : undefined, peerRoles, seed),
    ),
    leadership: clampScore(
      scoreLeadership("leadInvestor" in company ? company.leadInvestor : null, seed),
    ),
    product: clampScore(
      scoreProduct("industry" in company ? company.industry : undefined, roles, seed),
    ),
    culture: clampScore(
      scoreCulture("fundingDate" in company ? company.fundingDate : null, roles, seed),
    ),
  };

  // Tiny uniqueness nudge so identical metadata still won't share an identical polygon.
  radar.growth = clampScore(radar.growth + ((seed % 3) - 1));
  radar.product = clampScore(radar.product + (((seed >>> 3) % 3) - 1));
  radar.market = clampScore(radar.market + (((seed >>> 6) % 3) - 1));
  radar.leadership = clampScore(radar.leadership + (((seed >>> 9) % 3) - 1));
  radar.culture = clampScore(radar.culture + (((seed >>> 12) % 3) - 1));
  radar.capital = clampScore(radar.capital + (((seed >>> 15) % 3) - 1));

  return radar;
}

export function surgeFromRadarScores(radar: RadarData) {
  return Math.round(
    (radar.growth +
      radar.product +
      radar.market +
      radar.leadership +
      radar.culture +
      radar.capital) /
      6,
  );
}
