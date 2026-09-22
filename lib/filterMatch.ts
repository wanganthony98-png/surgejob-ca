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

/** Match filter against a single location string (HQ or role). */
export function singleLocationMatches(location: string, filter: string) {
  if (isOpenFilter(filter)) return true;
  const loc = normalizeKey(location);
  const filterKey = normalizeKey(filter);
  const city = normalizeKey(filter.split(",")[0] ?? filter);
  if (!city) return true;
  if (loc === filterKey) return true;
  if (loc.includes(filterKey) || filterKey.includes(loc)) return true;
  return loc.includes(city) || city.includes(loc.split(",")[0]?.trim() ?? loc);
}

/**
 * Location filter matches company HQ OR any active open-role location.
 */
export function locationMatches(
  companyLocation: string,
  filter: string,
  roleLocations: string[] = [],
) {
  if (isOpenFilter(filter)) return true;
  if (singleLocationMatches(companyLocation, filter)) return true;
  return roleLocations.some((loc) => singleLocationMatches(loc, filter));
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

/** Aggregate unique locations from company HQ + peer/open roles for filter UI. */
export function aggregateLocationOptions(
  companies: {
    location?: string | null;
    peerRoles?: { location?: string | null }[] | null;
  }[],
) {
  const set = new Set<string>();
  for (const company of companies) {
    const hq = String(company.location || "").trim();
    if (hq && !/^others$/i.test(hq)) set.add(hq);
    for (const role of company.peerRoles || []) {
      const loc = String(role.location || "").trim();
      if (loc) set.add(loc);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
