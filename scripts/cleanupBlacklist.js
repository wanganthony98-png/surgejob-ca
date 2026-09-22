/**
 * One-shot cleanup: delete Nvidia / global giants from Supabase companies.
 * Usage: node scripts/cleanupBlacklist.js
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const GLOBAL_GIANTS_BLACKLIST = [
  "Nvidia",
  "NVIDIA",
  "Microsoft",
  "Google",
  "Amazon",
  "Meta",
  "Apple",
  "Alphabet",
  "OpenAI",
  "IBM",
  "Oracle",
  "Salesforce",
  "Intel",
];

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

function isBlacklistedGiant(name) {
  const key = String(name || "").trim().toLowerCase();
  const set = new Set(GLOBAL_GIANTS_BLACKLIST.map((n) => n.toLowerCase()));
  if (set.has(key)) return true;
  return [...set].some((giant) => key === giant || key.startsWith(`${giant} `));
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

  const { data, error } = await supabase.from("companies").select("id,name");
  if (error) throw error;
  const matched = (data || []).filter((row) => isBlacklistedGiant(row.name));
  if (!matched.length) {
    console.log("No blacklisted giants found.");
    return;
  }
  const ids = matched.map((r) => r.id).filter(Boolean);
  const names = matched.map((r) => r.name);
  console.log("Deleting:", names.join(", "));
  if (ids.length) {
    const { error: delError } = await supabase.from("companies").delete().in("id", ids);
    if (delError) throw delError;
  } else {
    const { error: delError } = await supabase.from("companies").delete().in("name", names);
    if (delError) throw delError;
  }
  console.log(`Deleted ${matched.length} row(s).`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
