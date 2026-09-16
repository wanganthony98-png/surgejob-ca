export type WorkArrangement = "hybrid" | "remote" | "on-site";
export type RoleStatus = "active" | "stale";
export type SavedStatus = "considering" | "applied" | "closed";
export type EvidenceCompleteness = "complete" | "incomplete";

export type RadarData = {
  growth: number;
  product: number;
  market: number;
  leadership: number;
  culture: number;
  capital: number;
};

export type PeerRole = {
  title: string;
  location: string;
  url: string;
};

export type Company = {
  id: string;
  name: string;
  mark: string;
  markColor: string;
  industry: string;
  mission: string;
  fundingRound: string;
  fundingAmount: string | null;
  fundingDate: string | null;
  fundedRelative: string | null;
  leadInvestor: string | null;
  headcount: string;
  headcountLabel: string;
  location: string;
  hqCity?: string | null;
  locationRegion?: string | null;
  workArrangement: WorkArrangement;
  glassdoorRating: number | null;
  openRoleCount: number;
  evidenceCompleteness: EvidenceCompleteness;
  radarData?: RadarData | null;
  surgeIndex?: number | null;
  isActive?: boolean;
  linkedinUrl?: string | null;
  applyUrl?: string | null;
  websiteUrl?: string | null;
  hiringSignal?: string | null;
  peerRoles?: PeerRole[] | null;
};

export type Role = {
  id: string;
  companyId: string;
  title: string;
  location: string;
  workArrangement: WorkArrangement;
  postedDate: string | null;
  freshnessLabel: string;
  status: RoleStatus;
  sourceLabel: string | null;
  lastCheckedDate: string | null;
  requirements: string[];
  destinationUrl: string | null;
  destinationName: string | null;
  evidenceUnavailable?: boolean;
};

export type SavedApplication = {
  id: string;
  roleId: string;
  companyId: string;
  status: SavedStatus;
  savedDate: string;
  fitNotes: string;
  evidenceSummary: string;
};

export type Filters = {
  industry: string;
  funding: string;
  location: string;
  size: string;
  rating: string;
  roleStatus: string;
};

export type CompanyInsight = {
  companyId: string;
  scores: { metric: string; value: number }[];
  surgeIndex: number;
  tier: string;
  peers: CompanyPeer[];
};

export type CompanyPeer = {
  name: string;
  title: string;
  tag: string;
  linkedinUrl: string;
};

export type View =
  | { name: "dashboard" }
  | { name: "role"; roleId: string }
  | { name: "compare" }
  | { name: "apply"; roleId: string }
  | { name: "saved" };
