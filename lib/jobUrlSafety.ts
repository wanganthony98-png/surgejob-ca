/**
 * Job / LinkedIn URL hygiene — never keep contaminated or invented apply links.
 */

/** Brands that must never appear on SurgeJob role URLs (scraper contamination). */
export const CONTAMINATED_JOB_URL_RE =
  /tim[-_]?hortons|mcdonald'?s|starbucks|walmart|loblaw|subway\.com|burger.?king|restaurant[-_]?manager|indeed\.com\/cmp\/tim/i;

/** Fake / seed example LinkedIn job paths that must never be used as real apply URLs. */
export const EXAMPLE_JOB_URL_RE =
  /linkedin\.com\/jobs\/view\/(northstar|kitepath|harbourgrid|maplestack)|example\.com|placeholder|javascript:void/i;

export function isContaminatedJobUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return CONTAMINATED_JOB_URL_RE.test(String(url)) || EXAMPLE_JOB_URL_RE.test(String(url));
}

export function isUsableJobUrl(url: string | null | undefined): boolean {
  const raw = String(url || "").trim();
  if (!raw) return false;
  if (!/^https?:\/\//i.test(raw)) return false;
  if (isContaminatedJobUrl(raw)) return false;
  return true;
}

/**
 * Prefer an explicit role URL; otherwise company careers page; never a hardcoded example.
 */
export function resolveRoleApplyUrl(
  rawUrl: string | null | undefined,
  careersUrl: string | null | undefined,
): string | null {
  if (isUsableJobUrl(rawUrl)) return String(rawUrl).trim();
  if (isUsableJobUrl(careersUrl)) return String(careersUrl).trim();
  return null;
}

/** True when a scraped job listing appears to belong to the target company. */
export function jobBelongsToCompany(
  job: { company?: string | null; title?: string | null; apply_url?: string | null; url?: string | null },
  companyName: string,
): boolean {
  const brand = String(companyName || "").trim().toLowerCase();
  if (!brand) return false;

  const url = String(job.apply_url || job.url || "");
  if (isContaminatedJobUrl(url)) return false;

  const listedCompany = String(job.company || "").trim().toLowerCase();
  if (listedCompany) {
    if (listedCompany.includes(brand) || brand.includes(listedCompany)) return true;
    const tokens = brand.split(/\s+/).filter((t) => t.length > 2);
    if (tokens.length && tokens.every((t) => listedCompany.includes(t))) return true;
    // Explicit other employer → reject
    return false;
  }

  // No employer field: keep only if URL is usable and not a known contaminant.
  return isUsableJobUrl(url) || !url;
}
