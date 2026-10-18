/**
 * Job URL hygiene.
 * Never keep LinkedIn AuthWall "Recommended Jobs" links or unrelated domains.
 * Direct role links must be on the parent company domain or a trusted ATS board.
 */

export const CONTAMINATED_JOB_URL_RE =
  /tim[-_]?hortons|mcdonald'?s|starbucks|walmart|loblaw|subway\.com|burger.?king|restaurant[-_]?manager|indeed\.com\/cmp\/tim/i;

export const EXAMPLE_JOB_URL_RE =
  /linkedin\.com\/jobs\/view\/(northstar|kitepath|harbourgrid|maplestack)|example\.com|placeholder|javascript:void/i;

export const LINKEDIN_JOB_VIEW_RE = /linkedin\.com\/jobs\/view\//i;

const TRUSTED_ATS_SUFFIXES = ["greenhouse.io", "lever.co", "ashbyhq.com", "workable.com"];

const NAME_STOPWORDS = new Set([
  "tech",
  "labs",
  "systems",
  "software",
  "robotics",
  "group",
  "inc",
  "ltd",
  "corp",
  "company",
  "startup",
  "driving",
  "truck",
  "data",
  "health",
  "canadian",
  "canada",
]);

export type RoleUrlContext = {
  companyName?: string | null;
  careersUrl?: string | null;
  websiteUrl?: string | null;
};

export function isContaminatedJobUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const text = String(url);
  return CONTAMINATED_JOB_URL_RE.test(text) || EXAMPLE_JOB_URL_RE.test(text);
}

export function hostnameOf(url: string | null | undefined): string | null {
  const raw = String(url || "").trim();
  if (!raw) return null;
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return parsed.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function registrableDomain(host: string | null): string | null {
  if (!host) return null;
  const parts = host.toLowerCase().split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  return parts.slice(-2).join(".");
}

/** Logged-out LinkedIn injects third-party jobs at /jobs/view/. */
export function isLinkedInAuthWallJobUrl(url: string | null | undefined): boolean {
  return LINKEDIN_JOB_VIEW_RE.test(String(url || ""));
}

export function isLinkedInHost(url: string | null | undefined): boolean {
  const host = hostnameOf(url);
  return Boolean(host && (host === "linkedin.com" || host.endsWith(".linkedin.com")));
}

export function isUsableJobUrl(url: string | null | undefined): boolean {
  const raw = String(url || "").trim();
  if (!raw) return false;
  if (!/^https?:\/\//i.test(raw)) return false;
  if (isContaminatedJobUrl(raw)) return false;
  if (isLinkedInAuthWallJobUrl(raw) || isLinkedInHost(raw)) return false;
  return true;
}

/** Careers or website URL that is safe to open. Never a LinkedIn or guessed link. */
export function safeCompanyUrl(url: string | null | undefined): string | null {
  const raw = String(url || "").trim();
  if (!/^https?:\/\//i.test(raw)) return null;
  if (isContaminatedJobUrl(raw)) return null;
  if (isLinkedInAuthWallJobUrl(raw) || isLinkedInHost(raw)) return null;
  return raw;
}

function isTrustedAtsHost(host: string | null): boolean {
  if (!host) return false;
  return TRUSTED_ATS_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

function boardSlug(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    const parts = parsed.pathname
      .split("/")
      .filter(Boolean)
      .map((part) => decodeURIComponent(part).toLowerCase());
    if (!parts.length) return null;
    if (parts[0] === "j" || parts[0] === "jobs" || parts[0] === "job") return null;
    return parts[0];
  } catch {
    return null;
  }
}

function companyNameTokens(name: string | null | undefined): string[] {
  return String(name || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !NAME_STOPWORDS.has(token));
}

function sameOrganization(hostA: string | null, hostB: string | null): boolean {
  if (!hostA || !hostB) return false;
  if (hostA === hostB) return true;
  const rootA = registrableDomain(hostA);
  const rootB = registrableDomain(hostB);
  return Boolean(rootA && rootA === rootB);
}

function hostMatchesCompanyName(host: string, companyName: string | null | undefined): boolean {
  const label = (registrableDomain(host) || "").split(".")[0];
  if (!label) return false;
  return companyNameTokens(companyName).some((token) => label === token);
}

function atsMatchesCompany(url: string, context: RoleUrlContext): boolean {
  const slug = boardSlug(url);
  if (!slug) return false;
  const careers = context.careersUrl;
  if (careers && isTrustedAtsHost(hostnameOf(careers))) {
    const careersSlug = boardSlug(careers);
    if (careersSlug && careersSlug === slug) return true;
  }
  const tokens = companyNameTokens(context.companyName);
  if (!tokens.length) return false;
  const segments = slug.split("-").filter(Boolean);
  return tokens.some((token) => slug === token || segments.includes(token));
}

/** Explicit role link on the company domain or a matching ATS board. */
export function isVerifiedDirectRoleUrl(
  url: string | null | undefined,
  context: RoleUrlContext = {},
): boolean {
  if (!isUsableJobUrl(url)) return false;
  if (isLinkedInAuthWallJobUrl(url)) return false;
  const host = hostnameOf(url);
  if (!host) return false;
  if (isTrustedAtsHost(host)) return atsMatchesCompany(String(url), context);
  if (sameOrganization(host, hostnameOf(context.careersUrl))) return true;
  if (sameOrganization(host, hostnameOf(context.websiteUrl))) return true;
  if (hostMatchesCompanyName(host, context.companyName)) return true;
  return false;
}

/**
 * Prefer a verified role URL. Otherwise the parent careers page.
 * Never returns a LinkedIn /jobs/view link or a guessed domain.
 */
export function resolveRoleApplyUrl(
  rawUrl: string | null | undefined,
  careersUrl: string | null | undefined,
  context: RoleUrlContext = {},
): string | null {
  const ctx: RoleUrlContext = {
    companyName: context.companyName ?? null,
    websiteUrl: safeCompanyUrl(context.websiteUrl),
    careersUrl: safeCompanyUrl(careersUrl) || safeCompanyUrl(context.careersUrl),
  };
  if (isVerifiedDirectRoleUrl(rawUrl, ctx)) return String(rawUrl).trim();
  return ctx.careersUrl ?? null;
}

export function urlsPointAtSamePage(a: string | null | undefined, b: string | null | undefined) {
  const left = String(a || "").trim();
  const right = String(b || "").trim();
  if (!left || !right) return false;
  try {
    const leftUrl = new URL(left);
    const rightUrl = new URL(right);
    const path = (value: string) => value.replace(/\/+$/, "") || "/";
    return (
      leftUrl.origin === rightUrl.origin && path(leftUrl.pathname) === path(rightUrl.pathname)
    );
  } catch {
    return left === right;
  }
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
    return false;
  }

  // No employer field: keep only a verified direct link, or a listing with no URL yet.
  return isVerifiedDirectRoleUrl(url, { companyName }) || !url;
}
