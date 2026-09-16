import type { Company } from "./types";

const KNOWN_WEBSITES: Record<string, string> = {
  Cohere: "https://cohere.com",
  Waabi: "https://waabi.ai",
};

const KNOWN_CAREERS: Record<string, string> = {
  Cohere: "https://cohere.com/careers",
  Waabi: "https://waabi.ai/careers",
};

const KNOWN_LINKEDIN_SLUGS: Record<string, string> = {
  Cohere: "cohere-ai",
  Waabi: "waabi",
};

export function slugifyCompanyName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isLinkedInUrl(url: string) {
  return /linkedin\.com/i.test(url);
}

function knownKey(name: string) {
  const match = Object.keys(KNOWN_WEBSITES).find(
    (key) => key.toLowerCase() === name.trim().toLowerCase(),
  );
  return match ?? null;
}

export function getWebsiteUrl(company: Pick<Company, "name" | "websiteUrl">) {
  const known = knownKey(company.name);
  if (known) return KNOWN_WEBSITES[known];

  const raw = company.websiteUrl?.trim();
  if (raw && !isLinkedInUrl(raw)) {
    try {
      const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      return `${parsed.origin}`;
    } catch {
      // fall through
    }
  }

  const slug = slugifyCompanyName(company.name);
  return slug ? `https://${slug}.com` : "#";
}

export function getCareersUrl(company: Pick<Company, "name" | "applyUrl">) {
  const known = knownKey(company.name);
  if (known) return KNOWN_CAREERS[known];

  const apply = company.applyUrl?.trim();
  if (apply && !isLinkedInUrl(apply)) return apply;

  const slug = slugifyCompanyName(company.name);
  return slug ? `https://${slug}.com/careers` : "#";
}

export function getLinkedInJobsUrl(company: Pick<Company, "name" | "linkedinUrl">) {
  const known = knownKey(company.name);
  if (known) {
    return `https://www.linkedin.com/company/${KNOWN_LINKEDIN_SLUGS[known]}/jobs/`;
  }

  const linkedin = company.linkedinUrl?.trim();
  if (linkedin) {
    const match = linkedin.match(/linkedin\.com\/company\/([^/?#]+)/i);
    if (match?.[1]) {
      return `https://www.linkedin.com/company/${match[1]}/jobs/`;
    }
  }

  const slug = slugifyCompanyName(company.name);
  return slug
    ? `https://www.linkedin.com/company/${slug}/jobs/`
    : "https://www.linkedin.com/jobs/";
}

export function getCompanyActionUrls(company: Company) {
  return {
    websiteUrl: getWebsiteUrl(company),
    careersUrl: getCareersUrl(company),
    linkedInJobsUrl: getLinkedInJobsUrl(company),
  };
}

export function getLinkedInPeopleUrl(companyName: string, roleTitle?: string) {
  const keywords = roleTitle?.trim()
    ? `${companyName} ${roleTitle}`
    : companyName;
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;
}

export function careersExploreLabel(
  company: Pick<Company, "name" | "hiringSignal" | "openRoleCount">,
  peerCount: number,
) {
  const signal = company.hiringSignal?.trim() ?? "";
  const fromSignal =
    signal.match(/(\d+\+)\s*Open Roles/i)?.[1] ||
    signal.match(/High Growth:\s*(\d+\+)/i)?.[1] ||
    signal.match(/Hiring\s+(\d+)/i)?.[1];
  const countLabel =
    fromSignal ||
    (company.openRoleCount && company.openRoleCount > 0
      ? company.openRoleCount >= 6
        ? `${company.openRoleCount}+`
        : String(company.openRoleCount)
      : peerCount > 0
        ? String(peerCount)
        : null);
  return countLabel
    ? `Explore All ${countLabel} Open Positions on ${company.name} Careers →`
    : `Explore All Open Positions on ${company.name} Careers →`;
}

export function openRolesCountLabel(company: Company) {
  const peerCount = company.peerRoles?.length ?? 0;
  const signal = company.hiringSignal?.trim() ?? "";
  const fromSignal =
    signal.match(/(\d+\+)\s*Open Roles/i)?.[1] ||
    signal.match(/High Growth:\s*(\d+\+)/i)?.[1] ||
    signal.match(/Hiring\s+(\d+)/i)?.[1];
  if (fromSignal) return fromSignal;
  if (company.openRoleCount > 0) {
    return company.openRoleCount >= 6
      ? `${company.openRoleCount}+`
      : String(company.openRoleCount);
  }
  if (peerCount > 0) return String(peerCount);
  return null;
}
