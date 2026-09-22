import { SurgeJobApp } from "@/components/SurgeJobApp";
import { mockData } from "@/lib/seed";
import { mapCompanyRows } from "@/lib/mapCompany";
import { supabase } from "@/lib/supabaseClient";
import type { Company } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CompanyRow = Record<string, unknown>;

/**
 * 3-tier homepage: Cover → Level 1 board → Level 2 insight modal.
 * UI only shows companies with at least one open role (DB keeps zero-role rows for scrapes).
 */
function looksLikeGarbageName(name: unknown) {
  const text = String(name || "").trim();
  if (text.length < 3) return true;
  if (/\.(com|ca|io|org|net)\b/i.test(text)) return true;
  if (/^(has|self|funding|startup funding)$/i.test(text)) return true;
  if (/\b(sluggish growth|canada has problems|startup funding\s*q[1-4])\b/i.test(text)) {
    return true;
  }
  if (text.split(/\s+/).length > 6) return true;
  return false;
}

function hasOpenRoles(row: CompanyRow) {
  const count = Number(row.open_role_count ?? row.openRoleCount ?? 0);
  if (Number.isFinite(count) && count > 0) return true;
  const peers = row.peer_roles ?? row.peerRoles ?? row.open_roles ?? row.openRoles;
  return Array.isArray(peers) && peers.length > 0;
}

function hasValidProfile(row: CompanyRow) {
  const name = String(row.name || "").trim();
  if (!name || looksLikeGarbageName(name)) return false;
  return hasOpenRoles(row);
}

function sortCompanies(companies: Company[]) {
  return [...companies].sort((a, b) => {
    const rolesDelta = (b.openRoleCount || 0) - (a.openRoleCount || 0);
    if (rolesDelta !== 0) return rolesDelta;
    const activeDelta = Number(Boolean(b.isActive)) - Number(Boolean(a.isActive));
    if (activeDelta !== 0) return activeDelta;
    const aDate = a.fundingDate ? Date.parse(a.fundingDate) : 0;
    const bDate = b.fundingDate ? Date.parse(b.fundingDate) : 0;
    return (Number.isFinite(bDate) ? bDate : 0) - (Number.isFinite(aDate) ? aDate : 0);
  });
}

async function fetchCompanyRows() {
  const primary = await supabase
    .from("companies")
    .select("*")
    .order("updated_at", { ascending: false })
    .order("open_role_count", { ascending: false });

  if (!primary.error && primary.data != null) return primary.data as CompanyRow[];

  const missingUpdatedAt = /updated_at/i.test(primary.error?.message || "");
  if (missingUpdatedAt) {
    const byRoles = await supabase
      .from("companies")
      .select("*")
      .order("open_role_count", { ascending: false });
    if (!byRoles.error && byRoles.data != null) return byRoles.data as CompanyRow[];
  }

  const fallback = await supabase
    .from("companies")
    .select("*")
    .order("funding_date", { ascending: false });
  if (!fallback.error && fallback.data != null) return fallback.data as CompanyRow[];

  return null;
}

function companiesWithOpenRoles(companies: Company[]) {
  return companies.filter(
    (c) => (c.openRoleCount || 0) > 0 || (c.peerRoles?.length || 0) > 0,
  );
}

async function loadCompanies() {
  try {
    const rows = await fetchCompanyRows();
    if (!rows) return companiesWithOpenRoles(mockData);

    const usable = rows.filter(hasValidProfile);
    const live = sortCompanies(mapCompanyRows(usable));
    const withRoles = companiesWithOpenRoles(live);
    return withRoles.length > 0 ? withRoles : companiesWithOpenRoles(mockData);
  } catch {
    return companiesWithOpenRoles(mockData);
  }
}

export default async function Home() {
  const companies = await loadCompanies();
  return (
    <div className="min-h-screen bg-[#05070d]">
      <SurgeJobApp companies={companies} />
    </div>
  );
}
