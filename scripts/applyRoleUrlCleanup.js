/**
 * Shared Supabase walker for role URL cleanups.
 * Open roles live on companies.peer_roles (and companies.open_roles when present).
 * A public.open_roles table is updated too when it exists.
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const {
  isLinkedInAuthWallJobUrl,
  isVerifiedDirectRoleUrl,
  parentCareersUrl,
  parentWebsiteUrl,
  roleUrlValue,
  companyUrlContext,
  safeCompanyUrl,
} = require("./roleUrlSafety");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const raw of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function createServiceClient() {
  loadEnvFile(path.join(__dirname, "..", ".env.local"));
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "")
    .trim()
    .replace(/^["']|["']$/g, "");
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
    process.exit(1);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      "SUPABASE_SERVICE_ROLE_KEY is unset; using the anon/publishable key.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function replacementFor(company, mode) {
  const careers = parentCareersUrl(company);
  if (mode === "linkedin") return careers || parentWebsiteUrl(company) || null;
  return careers || null;
}

function shouldRewrite(role, company, mode) {
  const fields = [role?.url, role?.job_url, role?.apply_url];
  if (mode === "linkedin") return fields.some((value) => isLinkedInAuthWallJobUrl(value));

  const current = roleUrlValue(role);
  const verified =
    current &&
    !isLinkedInAuthWallJobUrl(current) &&
    isVerifiedDirectRoleUrl(current, companyUrlContext(company))
      ? String(current).trim()
      : null;
  const desired = verified || replacementFor(company, "corrupt");
  const aliasesDirty = [role?.job_url, role?.apply_url].some(
    (value) => value && value !== desired,
  );
  return (role?.url || null) !== (desired || null) || aliasesDirty;
}

function rewriteRole(role, company, mode) {
  if (!role || typeof role !== "object") return { role, changed: false };
  if (!shouldRewrite(role, company, mode)) return { role, changed: false };
  const nextUrl = replacementFor(company, mode);
  const next = { ...role, url: nextUrl || null };
  delete next.job_url;
  delete next.apply_url;
  return { role: next, changed: true };
}

function rewriteRoleList(roles, company, mode) {
  if (!Array.isArray(roles)) return { roles, changed: 0 };
  let changed = 0;
  const next = roles.map((role) => {
    const result = rewriteRole(role, company, mode);
    if (result.changed) changed += 1;
    return result.role;
  });
  return { roles: next, changed };
}

async function cleanCompanies(supabase, mode) {
  const { data, error } = await supabase.from("companies").select("*");
  if (error) throw error;

  let cleaned = 0;
  for (const row of data || []) {
    const peer = rewriteRoleList(row.peer_roles, row, mode);
    const open = rewriteRoleList(row.open_roles, row, mode);
    if (!peer.changed && !open.changed) continue;

    const patch = {};
    if (peer.changed) patch.peer_roles = peer.roles;
    if (open.changed) patch.open_roles = open.roles;

    const { data: updated, error: updError } = await supabase
      .from("companies")
      .update(patch)
      .eq("id", row.id)
      .select("id");
    if (updError) {
      console.warn(`Failed ${row.name}:`, updError.message || updError);
      continue;
    }
    if (!updated || updated.length === 0) {
      throw new Error(
        `Update for ${row.name} matched 0 rows. SUPABASE_SERVICE_ROLE_KEY is required; this key cannot write companies under RLS.`,
      );
    }
    cleaned += peer.changed + open.changed;
    const fallback = replacementFor(row, mode);
    console.log(
      `${row.name}: replaced ${peer.changed + open.changed} role URL(s) with ${fallback || "null"}`,
    );
  }
  return cleaned;
}

async function cleanOpenRolesTable(supabase, mode) {
  const probe = await supabase.from("open_roles").select("*").limit(1);
  if (probe.error) {
    console.log(
      `No public.open_roles table (${probe.error.message}). Using companies.peer_roles.`,
    );
    return 0;
  }

  const { data, error } = await supabase.from("open_roles").select("*");
  if (error) throw error;
  if (!data?.length) {
    console.log("public.open_roles is empty.");
    return 0;
  }

  const companyIds = [
    ...new Set(data.map((row) => row.company_id || row.companyId).filter(Boolean)),
  ];
  let companiesById = new Map();
  if (companyIds.length) {
    const companies = await supabase.from("companies").select("*").in("id", companyIds);
    if (!companies.error) {
      companiesById = new Map((companies.data || []).map((row) => [row.id, row]));
    }
  }

  let cleaned = 0;
  for (const row of data) {
    const company =
      companiesById.get(row.company_id || row.companyId) || {
        name: row.company_name || row.company || null,
        careers_url: row.careers_url,
        apply_url: row.careers_url || row.apply_url,
        website: row.website,
      };
    if (!shouldRewrite(row, company, mode)) continue;
    const nextUrl = replacementFor(company, mode);
    const patch = { url: nextUrl };
    if ("job_url" in row) patch.job_url = nextUrl;
    const { error: updError } = await supabase.from("open_roles").update(patch).eq("id", row.id);
    if (updError) {
      console.warn(`Failed open_roles ${row.id}:`, updError.message || updError);
      continue;
    }
    cleaned += 1;
  }
  return cleaned;
}

async function runCleanup(mode) {
  const supabase = createServiceClient();
  const fromTable = await cleanOpenRolesTable(supabase, mode);
  const fromCompanies = await cleanCompanies(supabase, mode);
  const total = fromTable + fromCompanies;
  if (mode === "linkedin") {
    console.log(`Purged ${total} bad LinkedIn job link${total === 1 ? "" : "s"}.`);
  } else {
    console.log(`Cleaned ${total} corrupt role URL${total === 1 ? "" : "s"}.`);
  }
  return total;
}

module.exports = {
  runCleanup,
  safeCompanyUrl,
};
