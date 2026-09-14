import type { Company, CompanyInsight, Role, SavedApplication } from "./types";

export const companies: Company[] = [
  {
    id: "northstar",
    name: "Northstar Ledger",
    mark: "NL",
    markColor: "#1d4ed8",
    industry: "Fintech",
    mission:
      "Builds ledger infrastructure for Canadian banks that need faster settlement without replacing their core systems.",
    fundingRound: "Series A",
    fundingAmount: "$12M CAD",
    fundingDate: "February 2026",
    fundedRelative: "Funded 3 weeks ago",
    leadInvestor: "Inovia Capital",
    headcount: "51-200",
    headcountLabel: "51-200 employees",
    location: "Toronto, ON",
    workArrangement: "hybrid",
    glassdoorRating: 4.3,
    openRoleCount: 3,
    evidenceCompleteness: "complete",
  },
  {
    id: "kitepath",
    name: "Kitepath AI",
    mark: "KA",
    markColor: "#7c3aed",
    industry: "AI & Data",
    mission:
      "Helps Canadian insurers underwrite faster with models trained on consented, region-specific claims data.",
    fundingRound: "Series B",
    fundingAmount: "$28M CAD",
    fundingDate: "January 2026",
    fundedRelative: "Funded 6 weeks ago",
    leadInvestor: "Georgian",
    headcount: "51-200",
    headcountLabel: "51-200 employees",
    location: "Montreal, QC",
    workArrangement: "hybrid",
    glassdoorRating: 4.5,
    openRoleCount: 2,
    evidenceCompleteness: "complete",
  },
  {
    id: "harbourgrid",
    name: "HarbourGrid",
    mark: "HG",
    markColor: "#0f766e",
    industry: "CleanTech & Energy",
    mission:
      "Maps grid congestion for utilities so they can add storage where it actually reduces peak load.",
    fundingRound: "Seed",
    fundingAmount: "$7M CAD",
    fundingDate: "February 2026",
    fundedRelative: "Funded 3 weeks ago",
    leadInvestor: "BDC Capital",
    headcount: "11-50",
    headcountLabel: "11-50 employees",
    location: "Vancouver, BC",
    workArrangement: "remote",
    glassdoorRating: null,
    openRoleCount: 1,
    evidenceCompleteness: "incomplete",
  },
  {
    id: "maplestack",
    name: "MapleStack",
    mark: "MS",
    markColor: "#c2410c",
    industry: "B2B SaaS",
    mission:
      "Gives mid-market operations teams one place to run inventory, billing, and customer handoff.",
    fundingRound: "Series A",
    fundingAmount: "$19M CAD",
    fundingDate: "December 2025",
    fundedRelative: "Funded 3 months ago",
    leadInvestor: "Real Ventures",
    headcount: "200+",
    headcountLabel: "200+ employees",
    location: "Waterloo, ON",
    workArrangement: "hybrid",
    glassdoorRating: 4.1,
    openRoleCount: 4,
    evidenceCompleteness: "complete",
  },
  {
    id: "capis",
    name: "Canadian Applied Privacy Infrastructure Systems",
    mark: "CA",
    markColor: "#334155",
    industry: "Privacy & Security",
    mission:
      "Designs privacy-preserving identity rails for public-sector vendors that must keep citizen data in Canada while still interoperating with provincial registries, municipal portals, and federated login programs that were never built to talk to each other.",
    fundingRound: "Series A",
    fundingAmount: "$9M CAD",
    fundingDate: null,
    fundedRelative: null,
    leadInvestor: null,
    headcount: "11-50",
    headcountLabel: "11-50 employees",
    location: "Ottawa, ON",
    workArrangement: "hybrid",
    glassdoorRating: null,
    openRoleCount: 1,
    evidenceCompleteness: "incomplete",
  },
];

export const roles: Role[] = [
  {
    id: "northstar-backend",
    companyId: "northstar",
    title: "Senior Backend Developer",
    location: "Toronto, ON",
    workArrangement: "hybrid",
    postedDate: "March 8, 2026",
    freshnessLabel: "Active",
    status: "active",
    sourceLabel: "Company careers page",
    lastCheckedDate: "March 10, 2026",
    destinationUrl: "https://www.linkedin.com/jobs/view/northstar-senior-backend",
    destinationName: "Northstar Ledger careers",
    requirements: [
      "5+ years building production APIs in Go or Node.js",
      "Hands-on PostgreSQL, queues, and service ownership",
      "Comfortable in a hybrid Toronto team with Canadian work authorization",
      "Experience in payments, ledger, or high-integrity financial data is a plus",
    ],
  },
  {
    id: "kitepath-ml",
    companyId: "kitepath",
    title: "Machine Learning Engineer",
    location: "Montreal, QC",
    workArrangement: "hybrid",
    postedDate: "March 5, 2026",
    freshnessLabel: "Active",
    status: "active",
    sourceLabel: "Company careers page",
    lastCheckedDate: "March 9, 2026",
    destinationUrl: "https://www.linkedin.com/jobs/view/kitepath-ml-engineer",
    destinationName: "Kitepath AI careers",
    requirements: [
      "Production ML experience with Python, evaluation, and monitoring",
      "Comfort working with regulated data and documented consent paths",
      "Ability to ship models with product and underwriting partners",
      "Hybrid Montreal collaboration; French is helpful, not required",
    ],
  },
  {
    id: "harbourgrid-analyst",
    companyId: "harbourgrid",
    title: "Data Analyst",
    location: "Vancouver, BC",
    workArrangement: "remote",
    postedDate: "February 1, 2026",
    freshnessLabel: "Stale",
    status: "stale",
    sourceLabel: "Third-party listing",
    lastCheckedDate: "February 20, 2026",
    destinationUrl: "https://www.linkedin.com/jobs/view/harbourgrid-data-analyst",
    destinationName: "HarbourGrid listing",
    requirements: [
      "SQL and dashboarding experience with messy operational data",
      "Interest in energy, utilities, or infrastructure datasets",
      "Remote-first communication across Pacific time",
      "Ability to explain findings to non-technical grid operators",
    ],
  },
  {
    id: "maplestack-designer",
    companyId: "maplestack",
    title: "Product Designer",
    location: "Waterloo, ON",
    workArrangement: "hybrid",
    postedDate: "March 7, 2026",
    freshnessLabel: "Active",
    status: "active",
    sourceLabel: "Company careers page",
    lastCheckedDate: "March 11, 2026",
    destinationUrl: "https://www.linkedin.com/jobs/view/maplestack-product-designer",
    destinationName: "MapleStack careers",
    requirements: [
      "End-to-end product design for B2B workflows",
      "Strong systems thinking across inventory, billing, and handoff",
      "Portfolio showing shipped work with engineering partners",
      "Hybrid Waterloo collaboration a few days each week",
    ],
  },
  {
    id: "capis-privacy",
    companyId: "capis",
    title:
      "Staff Privacy Engineer, Cross-Provincial Identity Interoperability",
    location: "Ottawa, ON",
    workArrangement: "hybrid",
    postedDate: "March 3, 2026",
    freshnessLabel: "Active",
    status: "active",
    sourceLabel: null,
    lastCheckedDate: null,
    destinationUrl: null,
    destinationName: null,
    evidenceUnavailable: true,
    requirements: [
      "Deep experience with privacy engineering, threat modeling, and data minimization",
      "Familiarity with Canadian public-sector identity and residency constraints",
      "Ability to wrap long technical requirements into clear delivery plans",
      "Hybrid Ottawa presence for stakeholder workshops",
    ],
  },
];

export const industries = [
  "All industries",
  "Fintech",
  "AI & Data",
  "CleanTech & Energy",
  "B2B SaaS",
  "Privacy & Security",
] as const;

export const defaultSaved: SavedApplication[] = [
  {
    id: "saved-maplestack",
    roleId: "maplestack-designer",
    companyId: "maplestack",
    status: "considering",
    savedDate: "March 12, 2026",
    fitNotes:
      "The hybrid Waterloo setup works if I keep Tuesdays and Thursdays on-site. MapleStack’s Series A and 200+ headcount look more stable than HarbourGrid, and the 4.1 Glassdoor rating is enough to keep researching. I want to confirm the designer would own billing workflows rather than only marketing pages. The posted date is March 7 and the listing was checked March 11, so this still feels current. I would apply after comparing Northstar’s backend role against this one for growth versus craft. Notes on commute, team size, design-system maturity, and whether the hiring manager is still filling this seat should stay attached when I leave for the careers page.",
    evidenceSummary:
      "Active role, checked March 11, 2026. Source: Company careers page. Glassdoor 4.1. Funding: $19M Series A, December 2025.",
  },
];

export function getInsight(companyId: string) {
  return companyInsights.find((item) => item.companyId === companyId);
}

function buildInsight(
  companyId: string,
  values: number[],
  peers: CompanyInsight["peers"],
): CompanyInsight {
  const metrics = [
    "Capital Velocity",
    "Headcount Growth",
    "Institutional Backing",
    "Cultural Health",
    "Fresh Opportunity",
    "Market Traction",
  ];
  const surgeIndex = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  const tier =
    surgeIndex >= 85 ? "Tier 1 Growth" : surgeIndex >= 72 ? "Tier 2 Scaling" : "Early Signal";
  return {
    companyId,
    scores: metrics.map((metric, index) => ({ metric, value: values[index] })),
    surgeIndex,
    tier,
    peers,
  };
}

export const companyInsights: CompanyInsight[] = [
  buildInsight("northstar", [88, 82, 91, 84, 90, 80], [
    {
      name: "Jordan Hale",
      title: "Sr. Software Engineer",
      tag: "Joined 8 mos ago • Ex-Shopify",
      linkedinUrl: "https://www.linkedin.com/in/example-jordan-hale",
    },
    {
      name: "Priya Nair",
      title: "Backend Lead",
      tag: "Joined 1 yr ago • Ex-RBC",
      linkedinUrl: "https://www.linkedin.com/in/example-priya-nair",
    },
  ]),
  buildInsight("kitepath", [94, 86, 96, 90, 84, 88], [
    {
      name: "Camille Bouchard",
      title: "ML Engineer",
      tag: "Joined 6 mos ago • Ex-Element AI",
      linkedinUrl: "https://www.linkedin.com/in/example-camille-bouchard",
    },
    {
      name: "Daniel Cho",
      title: "Applied Scientist",
      tag: "Joined 11 mos ago • Ex-Google",
      linkedinUrl: "https://www.linkedin.com/in/example-daniel-cho",
    },
  ]),
  buildInsight("harbourgrid", [74, 68, 80, 52, 58, 70], [
    {
      name: "Maya Singh",
      title: "Data Analyst",
      tag: "Joined 14 mos ago • Ex-BC Hydro",
      linkedinUrl: "https://www.linkedin.com/in/example-maya-singh",
    },
  ]),
  buildInsight("maplestack", [86, 90, 78, 80, 70, 85], [
    {
      name: "Sam Ortega",
      title: "Product Designer",
      tag: "Joined 5 mos ago • Ex-Wish",
      linkedinUrl: "https://www.linkedin.com/in/example-sam-ortega",
    },
    {
      name: "Elena Park",
      title: "Design Manager",
      tag: "Joined 2 yrs ago • Ex-OpenText",
      linkedinUrl: "https://www.linkedin.com/in/example-elena-park",
    },
  ]),
  buildInsight("capis", [64, 60, 48, 50, 62, 58], [
    {
      name: "Noah Tremblay",
      title: "Privacy Engineer",
      tag: "Joined 9 mos ago • Ex-CSE",
      linkedinUrl: "https://www.linkedin.com/in/example-noah-tremblay",
    },
    {
      name: "Aisha Rahman",
      title: "Staff Security Engineer",
      tag: "Joined 4 mos ago • Ex-Shopify",
      linkedinUrl: "https://www.linkedin.com/in/example-aisha-rahman",
    },
  ]),
];

export function getCompany(id: string) {
  return companies.find((c) => c.id === id);
}

export function getRole(id: string) {
  return roles.find((r) => r.id === id);
}

export function roleForCompany(companyId: string) {
  return roles.find((r) => r.companyId === companyId);
}

export function formatArrangement(value: Role["workArrangement"]) {
  if (value === "on-site") return "On-site";
  return value[0].toUpperCase() + value.slice(1);
}

export function formatFunding(company: Company) {
  const amount = company.fundingAmount ?? "Not available";
  return `${amount} • ${company.fundingRound}`;
}

export function unavailable(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "Not available";
  return String(value);
}

export function buildEvidenceSummary(role: Role, company: Company) {
  const checked = role.lastCheckedDate
    ? `checked ${role.lastCheckedDate}`
    : "last checked date not available";
  const source = role.sourceLabel ?? "source not available";
  const rating =
    company.glassdoorRating === null
      ? "Glassdoor rating not available"
      : `Glassdoor ${company.glassdoorRating}`;
  const fundingDate = company.fundingDate ?? "funding date not available";
  const funding = company.fundingAmount
    ? `${company.fundingAmount} ${company.fundingRound}, ${fundingDate}`
    : `${company.fundingRound}, ${fundingDate}`;
  return `${role.freshnessLabel} role, ${checked}. Source: ${source}. ${rating}. Funding: ${funding}.`;
}
