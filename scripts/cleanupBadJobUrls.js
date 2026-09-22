/**
 * Clean contaminated peer_roles / apply URLs (e.g. Tim Hortons Restaurant Manager)
 * from Supabase companies. Resets bad job URLs to company careers/apply_url or null.
 *
 * Usage: node scripts/cleanupBadJobUrls.js
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const CONTAMINATED_JOB_URL_RE =
  /tim[-_]?hortons|mcdonald'?s|starbucks|walmart|loblaw|subway\.com|burger.?king|restaurant[-_]?manager|indeed\.com\/cmp\/tim/i;
const EXAMPLE_JOB_URL_RE =
  /linkedin\.com\/jobs\/view\/(northstar|kitepath|harbourgrid|maplestack)|example\.com|placeholder|javascript:void/i;

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

loadEnvFile(path.join(__dirname, "..", ".env.local"));

function isBadJobUrl(url) {
  const text = String(url || "");
  if (!text) return false;
  return CONTAMINATED_JOB_URL_RE.test(text) || EXAMPLE_JOB_URL_RE.test(text);
}

function sanitizePeerRoles(peerRoles, careersUrl) {
  if (!Array.isArray(peerRoles)) return { roles: peerRoles, changed: false };
  let changed = false;
  const roles = peerRoles.map((role) => {
    if (!role || typeof role !== "object") return role;
    const url = role.url || role.apply_url || role.job_url || null;
    if (!isBadJobUrl(url)) return role;
    changed = true;
    const next = { ...role, url: careersUrl || null };
    delete next.apply_url;
    delete next.job_url;
    return next;
  });
  return { roles, changed };
}

async function main() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "")
    .trim()
    .replace(/^["']|["']$/g, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("companies")
    .select("id,name,apply_url,peer_roles");
  if (error) throw error;

  let updated = 0;
  for (const row of data || []) {
    const careers =
      (row.apply_url && !/tim[-_]?hortons/i.test(String(row.apply_url))
        ? row.apply_url
        : null) || null;
    const { roles, changed: rolesChanged } = sanitizePeerRoles(row.peer_roles, careers);
    const applyIsBad = isBadJobUrl(row.apply_url);
    if (!rolesChanged && !applyIsBad) continue;

    const patch = {};
    if (rolesChanged) patch.peer_roles = roles;
    if (applyIsBad) patch.apply_url = null;

    const { error: updError } = await supabase
      .from("companies")
      .update(patch)
      .eq("id", row.id);
    if (updError) {
      console.warn(`Failed ${row.name}:`, updError.message || updError);
      continue;
    }
    updated += 1;
    console.log(`Cleaned ${row.name}`);
  }

  console.log(`Done. Updated ${updated} compan${updated === 1 ? "y" : "ies"}.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
