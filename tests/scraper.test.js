const test = require("node:test");
const assert = require("node:assert/strict");

const {
  GLOBAL_GIANTS_BLACKLIST,
  isBlacklistedCompany,
  toCompanyRow,
  buildSandboxCompanyRows,
  purgeBlacklistedCompanies,
} = require("../scripts/scrapeJobs.js");

test("blacklist contains the required global giants", () => {
  for (const name of ["Nvidia", "NVIDIA", "Microsoft", "Google", "Amazon", "Meta", "Apple"]) {
    assert.ok(GLOBAL_GIANTS_BLACKLIST.includes(name), `${name} should be blacklisted`);
  }
});

test("isBlacklistedCompany is case-insensitive and trims", () => {
  assert.equal(isBlacklistedCompany("Nvidia"), true);
  assert.equal(isBlacklistedCompany("  nvidia "), true);
  assert.equal(isBlacklistedCompany("NVIDIA"), true);
  assert.equal(isBlacklistedCompany("google"), true);
  assert.equal(isBlacklistedCompany("Northstar Ledger"), false);
  assert.equal(isBlacklistedCompany(""), false);
  assert.equal(isBlacklistedCompany(null), false);
});

test("toCompanyRow discards a blacklisted giant but keeps a normal startup", () => {
  const nvidia = toCompanyRow(
    { is_valid_funding_news: true, name: "Nvidia", tagline: "Builds AI chips." },
    { title: "Nvidia raises $100M", snippet: "Nvidia announced new funding." },
  );
  assert.equal(nvidia, null, "Nvidia must be discarded");

  const startup = toCompanyRow(
    { is_valid_funding_news: true, name: "Northwind Labs", tagline: "Builds logistics software." },
    { title: "Northwind Labs raises $8M", snippet: "Northwind Labs closed a seed round." },
  );
  assert.ok(startup && startup.name, "a normal startup should produce a row");
  assert.equal(isBlacklistedCompany(startup.name), false);
});

test("buildSandboxCompanyRows never emits a blacklisted giant", () => {
  const rows = buildSandboxCompanyRows();
  for (const row of rows) {
    assert.equal(isBlacklistedCompany(row.name), false);
  }
});

test("purgeBlacklistedCompanies deletes Nvidia rows and attempts role cleanup", async () => {
  const rows = [
    { id: "id-nvidia", name: "Nvidia" },
    { id: "id-nvidia2", name: "NVIDIA" },
    { id: "id-cohere", name: "Cohere" },
  ];
  const deletes = { companies: [], roles: [] };
  const fakeSupabase = {
    from(table) {
      return {
        select() {
          return Promise.resolve({ data: table === "companies" ? rows : [], error: null });
        },
        delete() {
          return {
            in(col, vals) {
              deletes[table].push({ col, vals });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };

  const purged = await purgeBlacklistedCompanies(fakeSupabase);
  assert.equal(purged, 2, "both Nvidia rows should be purged, Cohere kept");

  const companyDelete = deletes.companies.find((d) => d.col === "id");
  assert.ok(companyDelete, "companies deleted by id");
  assert.deepEqual(companyDelete.vals.sort(), ["id-nvidia", "id-nvidia2"]);
  assert.ok(!companyDelete.vals.includes("id-cohere"), "Cohere must not be deleted");

  const rolesDelete = deletes.roles.find((d) => d.col === "company_id");
  assert.ok(rolesDelete, "associated roles cleanup attempted by company_id");
});
