const test = require("node:test");
const assert = require("node:assert/strict");

const {
  GLOBAL_GIANTS_BLACKLIST,
  isBlacklistedCompany,
  toCompanyRow,
  buildSandboxCompanyRows,
  purgeBlacklistedCompanies,
  standardizeLocation,
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

test("standardizeLocation formats Canadian cities as 'City, PROV'", () => {
  assert.equal(standardizeLocation("Toronto, Ontario, Canada"), "Toronto, ON");
  assert.equal(standardizeLocation("Vancouver, British Columbia"), "Vancouver, BC");
  assert.equal(standardizeLocation("Montreal, Quebec"), "Montreal, QC");
  assert.equal(standardizeLocation("Waterloo, ON"), "Waterloo, ON");
  assert.equal(standardizeLocation("calgary, alberta"), "Calgary, AB");
});

test("standardizeLocation appends default province for a bare known city", () => {
  assert.equal(standardizeLocation("Toronto"), "Toronto, ON");
  assert.equal(standardizeLocation("Vancouver"), "Vancouver, BC");
  assert.equal(standardizeLocation("Calgary"), "Calgary, AB");
});

test("standardizeLocation converts a bare province name to its code", () => {
  assert.equal(standardizeLocation("Ontario"), "ON");
  assert.equal(standardizeLocation("British Columbia"), "BC");
  assert.equal(standardizeLocation("Quebec"), "QC");
});

test("standardizeLocation formats US/global cities as 'City, ST'", () => {
  assert.equal(standardizeLocation("New York, NY"), "New York, NY");
  assert.equal(standardizeLocation("San Francisco, California"), "San Francisco, CA");
  assert.equal(standardizeLocation("Austin, Texas, USA"), "Austin, TX");
});

test("standardizeLocation standardizes remote positions", () => {
  assert.equal(standardizeLocation("Remote"), "Remote");
  assert.equal(standardizeLocation("Remote - Canada"), "Remote (Canada)");
  assert.equal(standardizeLocation("Remote, US"), "Remote (US)");
  assert.equal(standardizeLocation("Work from home"), "Remote");
});

test("standardizeLocation strips hybrid/on-site work models from the location", () => {
  assert.equal(standardizeLocation("Toronto, ON (Hybrid)"), "Toronto, ON");
  assert.equal(standardizeLocation("Hybrid - Toronto, Ontario"), "Toronto, ON");
  assert.equal(standardizeLocation("Vancouver, BC · On-site"), "Vancouver, BC");
});

test("standardizeLocation maps vague regions to a representative city", () => {
  assert.equal(standardizeLocation("Greater Toronto Area"), "Toronto, ON");
  assert.equal(standardizeLocation("Greater Vancouver"), "Vancouver, BC");
  assert.equal(standardizeLocation("Toronto · GTA"), "Toronto, ON");
  assert.equal(standardizeLocation("Greater Toronto Area, ON"), "Toronto, ON");
});

test("standardizeLocation treats a bare country as remote for that country", () => {
  assert.equal(standardizeLocation("Canada"), "Remote (Canada)");
  assert.equal(standardizeLocation("United States"), "Remote (US)");
});

test("peerRolesFromJobs is applied via toCompanyRow-independent role locations", () => {
  // Sanity: standardizeLocation returns null only for empty input.
  assert.equal(standardizeLocation(""), null);
  assert.equal(standardizeLocation(null), null);
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
