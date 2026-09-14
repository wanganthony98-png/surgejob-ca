import type { Company, EvidenceCompleteness, WorkArrangement } from "./types";

function asString(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function asNullableString(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
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

export function mapCompanyRow(row: Record<string, unknown>): Company | null {
  const id = asString(row.id ?? row.slug);
  const name = asString(row.name);
  if (!id || !name) return null;

  const headcount = asString(row.headcount ?? row.size ?? row.headcount_range, "11-50");
  const headcountLabel = asString(
    row.headcountLabel ?? row.headcount_label,
    `${headcount} employees`,
  );

  return {
    id,
    name,
    mark: asString(row.mark, initials(name)),
    markColor: asString(row.markColor ?? row.mark_color, "#0f766e"),
    industry: asString(row.industry, "B2B SaaS"),
    mission: asString(row.mission ?? row.description, ""),
    fundingRound: asString(row.fundingRound ?? row.funding_round, "Seed"),
    fundingAmount: asNullableString(row.fundingAmount ?? row.funding_amount),
    fundingDate: asNullableString(row.fundingDate ?? row.funding_date),
    fundedRelative: asNullableString(row.fundedRelative ?? row.funded_relative),
    leadInvestor: asNullableString(row.leadInvestor ?? row.lead_investor),
    headcount,
    headcountLabel,
    location: asString(row.location, "Canada"),
    workArrangement: arrangement(row.workArrangement ?? row.work_arrangement),
    glassdoorRating: asNumber(row.glassdoorRating ?? row.glassdoor_rating),
    openRoleCount: asNumber(row.openRoleCount ?? row.open_role_count) ?? 0,
    evidenceCompleteness: completeness(row.evidenceCompleteness ?? row.evidence_completeness),
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
