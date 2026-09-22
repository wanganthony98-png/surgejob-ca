import type { Company } from "./types";

/**
 * A company is shown only when it has at least one open role. In live Supabase
 * data an empty `open_roles`/`peer_roles` array travels with `open_role_count: 0`,
 * so we treat either a positive count OR a non-empty roles array as "has roles"
 * to avoid hiding rows whose count and array are briefly out of sync.
 */
export function hasOpenRoles(
  company: Pick<Company, "openRoleCount" | "peerRoles">,
): boolean {
  const count = Number(company.openRoleCount ?? 0);
  if (Number.isFinite(count) && count > 0) return true;
  return Array.isArray(company.peerRoles) && company.peerRoles.length > 0;
}

/** Treat "All" / "all" / empty filter values as unfiltered. */
export function isOpenFilter(value: string | null | undefined) {
  if (value == null) return true;
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "" ||
    normalized === "all" ||
    normalized === "all industries" ||
    normalized === "any" ||
    normalized === "any round" ||
    normalized === "any city" ||
    normalized === "any size" ||
    normalized === "any rating" ||
    normalized === "active and stale"
  );
}

export function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[_–—-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function fundingMatches(companyRound: string, filter: string) {
  if (isOpenFilter(filter)) return true;
  return normalizeKey(companyRound) === normalizeKey(filter);
}

export function locationMatches(companyLocation: string, filter: string) {
  if (isOpenFilter(filter)) return true;
  const loc = normalizeKey(companyLocation);
  const city = normalizeKey(filter.split(",")[0] ?? filter);
  if (!city) return true;
  return loc.includes(city) || city.includes(loc.split(",")[0]?.trim() ?? loc);
}

export function sizeMatches(headcount: string, filter: string) {
  if (isOpenFilter(filter)) return true;
  const compact = (value: string) => normalizeKey(value).replace(/\s*to\s*/g, " ");
  return compact(headcount) === compact(filter);
}

export function industryMatches(companyIndustry: string, filter: string) {
  if (isOpenFilter(filter)) return true;
  return normalizeKey(companyIndustry) === normalizeKey(filter);
}
