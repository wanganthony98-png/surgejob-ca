import { openRolesCountLabel } from "./companyUrls";
import type { Company, RadarData } from "./types";

export type RadarDimension = keyof RadarData;

function fundingPhrase(company: Company) {
  const amount = company.fundingAmount?.trim();
  const round = company.fundingRound?.trim() || "recent funding";
  if (amount) return `${amount} in ${round} funding`;
  return `${round} funding`;
}

function rolesPhrase(company: Company) {
  const label =
    openRolesCountLabel(company) ||
    (company.openRoleCount > 0
      ? String(company.openRoleCount)
      : company.peerRoles?.length
        ? String(company.peerRoles.length)
        : null);
  if (!label) return null;
  if (/\+/.test(label) || Number(label) >= 20) return `${label} open roles`;
  if (Number(label) === 1) return "1 open role";
  return `${label} open roles`;
}

function productDomain(company: Company) {
  const hay = `${company.industry || ""} ${company.mission || ""}`.toLowerCase();
  if (/ai|data|llm|language|model/.test(hay)) return "enterprise AI platforms";
  if (/autonom|robot|truck|hardware/.test(hay)) return "autonomy and applied robotics";
  if (/fintech|pay|finance/.test(hay)) return "fintech infrastructure";
  if (/clean|energy/.test(hay)) return "cleantech systems";
  if (/saas|b2b/.test(hay)) return "B2B SaaS platforms";
  return company.industry?.trim() || "its core product category";
}

export function getScoreReason(company: Company, dimension: RadarDimension): string {
  const investor =
    company.leadInvestor && company.leadInvestor !== "Undisclosed"
      ? company.leadInvestor
      : null;
  const roles = rolesPhrase(company);
  const headcount = company.headcountLabel || company.headcount || "growing team size";
  const freshness = company.fundedRelative || company.fundingDate || "recent funding activity";
  const tags = [company.industry, company.location].filter(Boolean).join(" · ");

  switch (dimension) {
    case "capital":
      return investor
        ? `Raised ${fundingPhrase(company)} led by ${investor}, granting significant financial runway. This robust balance sheet ensures strong long-term resilience.`
        : `Raised ${fundingPhrase(company)}, granting significant financial runway. This robust balance sheet ensures strong long-term resilience.`;
    case "growth":
      return roles
        ? `Currently hiring for ${roles} across critical R&D and GTM teams. This signals a rapid transition into commercial scale.`
        : `Public open-role volume is still limited, so growth momentum reads more cautiously. Watch for fresh R&D and GTM listings as the clearest scale signal.`;
    case "product":
      return `Deep domain execution in ${productDomain(company)} with a strengthening tech moat. High customer pull across enterprise accounts supports durable product-market fit.`;
    case "market":
      return `Market demand is concentrated in ${tags || "Canadian tech"}, backed by ${headcount} capacity to serve the category. Breadth across hiring departments points to category leadership rather than a single-function spike.`;
    case "leadership":
      return investor
        ? `Lead investor signal from ${investor} validates diligence-tested founding-team execution. That backing usually improves strategic clarity, recruiting gravity, and follow-on credibility.`
        : `Leadership quality is inferred from public execution signals and org build-out rather than a named tier-one lead. Continued delivery against roadmap and hiring plans can still raise this score.`;
    case "culture":
      return `Culture strength tracks hiring freshness (${freshness}) and active candidate engagement via public career links. Teams that keep roles current usually sustain healthier operating tempo and onboarding throughput.`;
    default:
      return `${company.name}'s score is synthesized from public funding, hiring, and category signals on SurgeJob.`;
  }
}
