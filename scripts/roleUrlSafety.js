/**
 * Shared role-URL policy for the scraper and database cleanups.
 *
 * Unauthenticated LinkedIn HTML injects third-party "Recommended Jobs"
 * at linkedin.com/jobs/view/. Those links must never be stored or shown
 * as a company's open position. Direct role links are kept only when they
 * sit on the parent company's domain or a trusted ATS board for that company.
 */

const CONTAMINATED_JOB_URL_RE =
  /tim[-_]?hortons|mcdonald'?s|starbucks|walmart|loblaw|subway\.com|burger.?king|restaurant[-_]?manager|indeed\.com\/cmp\/tim/i;
const EXAMPLE_JOB_URL_RE =
  /linkedin\.com\/jobs\/view\/(northstar|kitepath|harbourgrid|maplestack)|example\.com|placeholder|javascript:void/i;
const LINKEDIN_JOB_VIEW_RE = /linkedin\.com\/jobs\/view\//i;

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

function hostnameOf(url) {
  const raw = String(url || "").trim();
  if (!raw) return null;
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return parsed.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function registrableDomain(host) {
  if (!host) return null;
  const parts = String(host).toLowerCase().split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  return parts.slice(-2).join(".");
}

function isLinkedInAuthWallJobUrl(url) {
  return LINKEDIN_JOB_VIEW_RE.test(String(url || ""));
}

function isLinkedInHost(url) {
  const host = hostnameOf(url);
  return Boolean(host && (host === "linkedin.com" || host.endsWith(".linkedin.com")));
}

function isContaminatedJobUrl(url) {
  if (!url) return false;
  const text = String(url);
  return CONTAMINATED_JOB_URL_RE.test(text) || EXAMPLE_JOB_URL_RE.test(text);
}

function isHttpUrl(url) {
  return /^https?:\/\//i.test(String(url || "").trim());
}

/** Syntactically usable apply link that is not LinkedIn and not a known contaminant. */
function isUsableJobUrl(url) {
  const raw = String(url || "").trim();
  if (!raw || !isHttpUrl(raw)) return false;
  if (isContaminatedJobUrl(raw)) return false;
  if (isLinkedInAuthWallJobUrl(raw) || isLinkedInHost(raw)) return false;
  return true;
}

/** Official company page safe to use as a careers/website fallback. Never LinkedIn. */
function safeCompanyUrl(url) {
  const raw = String(url || "").trim();
  if (!isHttpUrl(raw)) return null;
  if (isContaminatedJobUrl(raw)) return null;
  if (isLinkedInAuthWallJobUrl(raw) || isLinkedInHost(raw)) return null;
  return raw;
}

function isTrustedAtsHost(host) {
  if (!host) return false;
  return TRUSTED_ATS_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

function boardSlug(url) {
  try {
    const parsed = new URL(String(url).trim());
    const parts = parsed.pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part).toLowerCase());
    if (!parts.length) return null;
    if (parts[0] === "j" || parts[0] === "jobs" || parts[0] === "job") return null;
    return parts[0];
  } catch {
    return null;
  }
}

function companyNameTokens(name) {
  return String(name || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !NAME_STOPWORDS.has(token));
}

function sameOrganization(hostA, hostB) {
  if (!hostA || !hostB) return false;
  if (hostA === hostB) return true;
  const rootA = registrableDomain(hostA);
  const rootB = registrableDomain(hostB);
  return Boolean(rootA && rootA === rootB);
}

function hostMatchesCompanyName(host, companyName) {
  const label = (registrableDomain(host) || "").split(".")[0];
  if (!label) return false;
  return companyNameTokens(companyName).some((token) => label === token);
}

function atsMatchesCompany(url, context) {
  const slug = boardSlug(url);
  if (!slug) return false;
  const careers = context?.careersUrl;
  if (careers && isTrustedAtsHost(hostnameOf(careers))) {
    const careersSlug = boardSlug(careers);
    if (careersSlug && careersSlug === slug) return true;
  }
  const tokens = companyNameTokens(context?.companyName);
  if (!tokens.length) return false;
  const segments = slug.split("-").filter(Boolean);
  return tokens.some((token) => slug === token || segments.includes(token));
}

/**
 * True only for an explicit role link on the company's domain or its ATS board.
 * linkedin.com/jobs/view links are never verified.
 */
function isVerifiedDirectRoleUrl(url, context = {}) {
  if (!isUsableJobUrl(url)) return false;
  if (isLinkedInAuthWallJobUrl(url)) return false;
  const host = hostnameOf(url);
  if (!host) return false;
  if (isTrustedAtsHost(host)) return atsMatchesCompany(url, context);
  if (sameOrganization(host, hostnameOf(context.careersUrl))) return true;
  if (sameOrganization(host, hostnameOf(context.websiteUrl))) return true;
  if (hostMatchesCompanyName(host, context.companyName)) return true;
  return false;
}

function resolveRoleApplyUrl(rawUrl, careersUrl, context) {
  const ctx = {
    companyName: context?.companyName || null,
    websiteUrl: safeCompanyUrl(context?.websiteUrl),
    careersUrl: safeCompanyUrl(careersUrl) || safeCompanyUrl(context?.careersUrl),
  };
  if (isVerifiedDirectRoleUrl(rawUrl, ctx)) return String(rawUrl).trim();
  return ctx.careersUrl;
}

function parentCareersUrl(company) {
  if (!company || typeof company !== "object") return null;
  return (
    safeCompanyUrl(company.careers_url) ||
    safeCompanyUrl(company.careersUrl) ||
    safeCompanyUrl(company.apply_url) ||
    safeCompanyUrl(company.applyUrl) ||
    null
  );
}

function parentWebsiteUrl(company) {
  if (!company || typeof company !== "object") return null;
  return (
    safeCompanyUrl(company.website) ||
    safeCompanyUrl(company.website_url) ||
    safeCompanyUrl(company.websiteUrl) ||
    safeCompanyUrl(company.domain) ||
    null
  );
}

function roleUrlValue(role) {
  if (!role || typeof role !== "object") return null;
  const value = role.url || role.job_url || role.apply_url || null;
  return value ? String(value).trim() : null;
}

function companyUrlContext(company) {
  return {
    companyName: company?.name || null,
    careersUrl: parentCareersUrl(company),
    websiteUrl: parentWebsiteUrl(company),
  };
}

module.exports = {
  CONTAMINATED_JOB_URL_RE,
  EXAMPLE_JOB_URL_RE,
  LINKEDIN_JOB_VIEW_RE,
  isLinkedInAuthWallJobUrl,
  isLinkedInHost,
  isContaminatedJobUrl,
  isHttpUrl,
  isUsableJobUrl,
  safeCompanyUrl,
  isTrustedAtsHost,
  isVerifiedDirectRoleUrl,
  resolveRoleApplyUrl,
  parentCareersUrl,
  parentWebsiteUrl,
  roleUrlValue,
  companyUrlContext,
};
