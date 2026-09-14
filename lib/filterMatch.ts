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
