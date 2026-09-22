import { isOpenFilter, locationMatches, normalizeKey } from "./filterMatch";
import type { Company, Role } from "./types";

function clean(value: string | null | undefined) {
  return (value ?? "").trim();
}

function dedupeByLocation(locations: string[]) {
  const seen = new Map<string, string>();
  for (const loc of locations) {
    const key = normalizeKey(loc);
    if (key && !seen.has(key)) seen.set(key, loc);
  }
  return [...seen.values()];
}

/**
 * Locations advertised across a company's active open roles. Seed data keeps
 * roles in a separate `roles` list keyed by `companyId`; live Supabase data
 * carries them inline on `company.peerRoles`. Both sources are combined.
 */
export function activeRoleLocations(company: Company, roles: Role[]): string[] {
  const fromSeedRoles = (roles ?? [])
    .filter((role) => role.companyId === company.id && role.status === "active")
    .map((role) => role.location);
  const fromPeerRoles = (company.peerRoles ?? []).map((role) => role.location);
  return [...fromSeedRoles, ...fromPeerRoles].map(clean).filter(Boolean);
}

/** Unique set of a company's locations: HQ plus every active open-role location. */
export function companyLocations(company: Company, roles: Role[]): string[] {
  const raw = [clean(company.location), ...activeRoleLocations(company, roles)].filter(Boolean);
  return dedupeByLocation(raw);
}

/**
 * A company matches a location filter when its HQ OR any active open role is in
 * that location.
 */
export function companyMatchesLocation(
  company: Company,
  roles: Role[],
  filter: string,
): boolean {
  if (isOpenFilter(filter)) return true;
  return companyLocations(company, roles).some((loc) => locationMatches(loc, filter));
}

/** Unique, sorted list of every location across all companies (HQ + open roles). */
export function collectLocationOptions(companies: Company[], roles: Role[]): string[] {
  const all: string[] = [];
  for (const company of companies) {
    all.push(...companyLocations(company, roles));
  }
  return dedupeByLocation(all).sort((a, b) => a.localeCompare(b));
}
