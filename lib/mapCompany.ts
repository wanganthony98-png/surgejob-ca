import type {
  Company,
  EvidenceCompleteness,
  PeerRole,
  RadarData,
  WorkArrangement,
} from "./types";
import { sanitizeRoleLocation } from "./roleLocation";
import {
  aggregateLatestPostedAt,
  formatFreshnessLabel,
  toIsoDate,
} from "./freshness";
import { resolveRoleApplyUrl } from "./jobUrlSafety";

function asString(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function asNullableString(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function asUrl(value: unknown) {
  const raw = asNullableString(value);
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw.replace(/^\/+/, "")}`;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function arrangement(value: unknown): WorkArrangement {
  if (value === "hybrid" || value === "remote" || value === "on-site") return value;
  return "hybrid";
}

function completeness(value: unknown): EvidenceCompleteness {
  return value === "incomplete" ? "incomplete" : "complete";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "SJ";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function canonicalFundingRound(value: string) {
  const n = value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (n.includes("series c")) return "Series C";
  if (n.includes("series b")) return "Series B";
  if (n.includes("series a")) return "Series A";
  if (n.includes("pre seed") || n.includes("preseed")) return "Pre-seed";
  if (n.includes("seed")) return "Seed";
  return value.trim() || "Seed";
}

function clampRadar(n: number) {
  return Math.max(50, Math.min(95, Math.round(n)));
}

function parseRadarData(value: unknown): RadarData | null {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const keys = ["growth", "product", "market", "leadership", "culture", "capital"] as const;
  const next: Partial<RadarData> = {};
  for (const key of keys) {
    const num = asNumber(obj[key]);
    if (num === null) return null;
    next[key] = clampRadar(num);
  }
  return next as RadarData;
}

function isPeerRole(role: PeerRole | null | undefined): role is PeerRole {
  return role != null && typeof role.title === "string" && role.title.trim().length > 0;
}

function parsePeerRoles(value: unknown): PeerRole[] {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];

  const mapped: Array<PeerRole | null> = raw.map((item) => {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const title = asString(row.title).trim();
    const location = sanitizeRoleLocation(asString(row.location, "Remote (Canada)"));
    const rawUrl = asNullableString(row.url ?? row.apply_url ?? row.applyUrl ?? row.job_url);
    const url = resolveRoleApplyUrl(rawUrl, null);
    const postedAt = toIsoDate(
      asNullableString(row.postedAt ?? row.posted_at ?? row.posted_date ?? row.postedDate),
    );
    if (!title) return null;
    const role: PeerRole = {
      title,
      location,
      url,
      postedAt: postedAt ?? null,
    };
    return role;
  });

  return mapped.filter(isPeerRole);
}

function relativeFromFundingDate(fundingDate: string | null) {
  if (!fundingDate) return null;
  const funded = new Date(`${fundingDate}T00:00:00Z`);
  if (Number.isNaN(funded.getTime())) return null;
  const days = Math.max(
    0,
    Math.round((Date.now() - funded.getTime()) / (1000 * 60 * 60 * 24)),
  );
  if (days < 7) return "Funded this week";
  if (days < 30) return `Funded ${days} days ago`;
  if (days < 60) return "Funded last month";
  const months = Math.round(days / 30);
  return `Funded ${months} month${months === 1 ? "" : "s"} ago`;
}

export function mapCompanyRow(row: Record<string, unknown>): Company | null {
  const name = asString(row.name);
  if (!name) return null;
  const id = asString(row.id ?? row.slug, name);

  const headcount = asString(row.headcount ?? row.size ?? row.headcount_range, "11-50");
  const headcountLabel = asString(
    row.headcountLabel ?? row.headcount_label,
    `${headcount} employees`,
  );
  const hqCity = asNullableString(row.hq_city ?? row.hqCity);
  const locationRegion = asNullableString(row.location_region ?? row.locationRegion);
  const location = sanitizeRoleLocation(
    asString(
      row.location ??
        (hqCity && locationRegion ? `${hqCity}, ${locationRegion}` : hqCity || locationRegion),
      "Remote (Canada)",
    ),
  );
  const fundingRaw = asString(
    row.fundingRound ?? row.funding_round ?? row.funding_stage ?? row.funding ?? row.round,
    "Seed",
  );
  const fundingDate = asNullableString(row.fundingDate ?? row.funding_date);
  const radarData = parseRadarData(row.radar_data ?? row.radarData);
  const surgeIndex =
    asNumber(row.surge_index ?? row.surgeIndex) ??
    (radarData
      ? Math.round(
          (radarData.growth +
            radarData.product +
            radarData.market +
            radarData.leadership +
            radarData.culture +
            radarData.capital) /
            6,
        )
      : null);

  const lead = asNullableString(row.leadInvestor ?? row.lead_investor);
  const isActive =
    row.is_active === false || row.isActive === false
      ? false
      : row.is_active === true || row.isActive === true
        ? true
        : true;

  const peerRoles = parsePeerRoles(row.peerRoles ?? row.peer_roles);
  const openRoleCount = asNumber(row.openRoleCount ?? row.open_role_count) ?? 0;
  const freshnessFromRow = toIsoDate(
    asNullableString(row.freshness ?? row.freshness_date ?? row.freshnessDate),
  );
  const freshnessFromRoles = aggregateLatestPostedAt(peerRoles);
  const freshness =
    freshnessFromRow && freshnessFromRoles
      ? freshnessFromRow > freshnessFromRoles
        ? freshnessFromRow
        : freshnessFromRoles
      : freshnessFromRow || freshnessFromRoles;
  const freshnessLabel = formatFreshnessLabel(freshness, {
    openRoleCount,
    hasPeerRoles: peerRoles.length > 0,
  });

  return {
    id,
    name,
    mark: asString(row.mark, initials(name)),
    markColor: asString(row.markColor ?? row.mark_color, "#0f766e"),
    industry: asString(row.industry ?? row.sector, "Others"),
    mission: asString(row.tagline ?? row.mission ?? row.description ?? row.summary, ""),
    fundingRound: canonicalFundingRound(fundingRaw),
    fundingAmount: asNullableString(row.fundingAmount ?? row.funding_amount),
    fundingDate,
    fundedRelative:
      asNullableString(row.fundedRelative ?? row.funded_relative) ??
      relativeFromFundingDate(fundingDate),
    leadInvestor: lead && !/^unknown$/i.test(lead) ? lead : "Undisclosed",
    headcount,
    headcountLabel,
    location,
    hqCity,
    locationRegion,
    workArrangement: arrangement(row.workArrangement ?? row.work_arrangement),
    glassdoorRating: asNumber(row.glassdoorRating ?? row.glassdoor_rating),
    openRoleCount,
    evidenceCompleteness: completeness(row.evidenceCompleteness ?? row.evidence_completeness),
    radarData,
    surgeIndex,
    isActive,
    linkedinUrl: asNullableString(row.linkedinUrl ?? row.linkedin_url),
    applyUrl: asNullableString(row.applyUrl ?? row.apply_url),
    websiteUrl: asUrl(row.websiteUrl ?? row.website_url ?? row.website ?? row.domain),
    hiringSignal: asNullableString(row.hiringSignal ?? row.hiring_signal),
    peerRoles,
    freshness,
    freshnessLabel,
  };
}

export function mapCompanyRows(rows: unknown): Company[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return rows
    .map((row) =>
      row && typeof row === "object" ? mapCompanyRow(row as Record<string, unknown>) : null,
    )
    .filter((row): row is Company => row !== null);
}
