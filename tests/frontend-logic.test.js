const test = require("node:test");
const assert = require("node:assert/strict");

// Compiled from lib/*.ts by the `test:unit` npm script (see package.json).
const { hasOpenRoles } = require("./.tmp/filterMatch.js");
const {
  activeRoleLocations,
  companyLocations,
  companyMatchesLocation,
  collectLocationOptions,
} = require("./.tmp/companyLocations.js");
const { userFromSession, signInWithGoogle } = require("./.tmp/auth.js");
const { fetchSavedCompanyIds, addSavedJob, removeSavedJob } = require("./.tmp/savedJobs.js");

function company(overrides = {}) {
  return {
    id: "co",
    name: "Co",
    location: "Toronto, ON",
    openRoleCount: 1,
    peerRoles: null,
    ...overrides,
  };
}

function role(overrides = {}) {
  return {
    id: "r",
    companyId: "co",
    title: "Engineer",
    location: "Toronto, ON",
    status: "active",
    ...overrides,
  };
}

test("hasOpenRoles: hides zero-role companies, keeps companies with roles", () => {
  assert.equal(hasOpenRoles({ openRoleCount: 0, peerRoles: null }), false);
  assert.equal(hasOpenRoles({ openRoleCount: 0, peerRoles: [] }), false);
  assert.equal(hasOpenRoles({ openRoleCount: 3, peerRoles: null }), true);
  // count/array briefly out of sync: a non-empty roles array still counts.
  assert.equal(
    hasOpenRoles({ openRoleCount: 0, peerRoles: [{ title: "x", location: "Y", url: "z" }] }),
    true,
  );
});

test("companyLocations aggregates HQ + active seed roles + peer roles, deduped", () => {
  const c = company({ id: "co", location: "Toronto, ON", peerRoles: [{ title: "PM", location: "Remote", url: "u" }] });
  const roles = [
    role({ companyId: "co", location: "Ottawa, ON", status: "active" }),
    role({ companyId: "co", location: "Calgary, AB", status: "stale" }), // excluded (stale)
    role({ companyId: "other", location: "Halifax, NS", status: "active" }), // excluded (other co)
    role({ companyId: "co", location: "Toronto, ON", status: "active" }), // dupe of HQ
  ];
  const locs = companyLocations(c, roles);
  assert.deepEqual(locs.sort(), ["Ottawa, ON", "Remote", "Toronto, ON"].sort());
  assert.ok(!locs.includes("Calgary, AB"));
  assert.ok(!locs.includes("Halifax, NS"));

  const roleLocs = activeRoleLocations(c, roles);
  assert.ok(roleLocs.includes("Ottawa, ON"));
  assert.ok(roleLocs.includes("Remote"));
});

test("companyMatchesLocation matches on HQ OR an active open role", () => {
  const hqToronto = company({ id: "a", location: "Toronto, ON", peerRoles: null });
  const roles = [role({ companyId: "a", location: "Vancouver, BC", status: "active" })];

  assert.equal(companyMatchesLocation(hqToronto, roles, "all"), true); // open filter
  assert.equal(companyMatchesLocation(hqToronto, roles, "Toronto, ON"), true); // HQ match
  assert.equal(companyMatchesLocation(hqToronto, roles, "Vancouver, BC"), true); // role match
  assert.equal(companyMatchesLocation(hqToronto, roles, "Montreal, QC"), false); // neither
});

test("collectLocationOptions returns the unique sorted set across companies", () => {
  const companies = [
    company({ id: "a", location: "Toronto, ON", peerRoles: [{ title: "x", location: "Montreal, QC", url: "u" }] }),
    company({ id: "b", location: "Toronto, ON", peerRoles: null }),
  ];
  const roles = [role({ companyId: "b", location: "Vancouver, BC", status: "active" })];
  const options = collectLocationOptions(companies, roles);
  assert.deepEqual(options, ["Montreal, QC", "Toronto, ON", "Vancouver, BC"]);
});

test("userFromSession maps Supabase session metadata to the app user", () => {
  assert.equal(userFromSession(null), null);
  assert.equal(userFromSession({ user: null }), null);

  const u = userFromSession({
    user: {
      id: "uid-123",
      email: "ada@ex.com",
      user_metadata: { full_name: "Ada Byron", avatar_url: "https://img/a.png" },
    },
  });
  assert.deepEqual(u, {
    id: "uid-123",
    name: "Ada Byron",
    email: "ada@ex.com",
    avatarUrl: "https://img/a.png",
  });

  const fallback = userFromSession({ user: { id: "uid-9", email: "grace@ex.com", user_metadata: {} } });
  assert.equal(fallback.id, "uid-9");
  assert.equal(fallback.name, "grace");
  assert.equal(fallback.avatarUrl, null);
});

test("fetchSavedCompanyIds returns the user's saved company IDs (filtering blanks)", async () => {
  const calls = {};
  const client = {
    from(table) {
      calls.table = table;
      const q = {
        select(cols) {
          calls.select = cols;
          return q;
        },
        eq(col, val) {
          calls.eq = { col, val };
          return q;
        },
        then(resolve) {
          resolve({
            data: [{ company_id: "northstar" }, { company_id: "kitepath" }, { company_id: "" }],
            error: null,
          });
        },
      };
      return q;
    },
  };
  const ids = await fetchSavedCompanyIds(client, "user-1");
  assert.deepEqual(ids, ["northstar", "kitepath"]);
  assert.equal(calls.table, "user_saved_jobs");
  assert.deepEqual(calls.eq, { col: "user_id", val: "user-1" });
});

test("addSavedJob upserts on the user_id + company_id composite key", async () => {
  let captured = null;
  const client = {
    from() {
      return {
        upsert(row, opts) {
          captured = { row, opts };
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  await addSavedJob(client, "u1", "northstar");
  assert.deepEqual(captured.row, { user_id: "u1", company_id: "northstar" });
  assert.equal(captured.opts.onConflict, "user_id,company_id");
});

test("removeSavedJob deletes the row scoped to user_id + company_id", async () => {
  const eqs = [];
  const client = {
    from() {
      return {
        delete() {
          const q = {
            eq(col, val) {
              eqs.push({ col, val });
              return q;
            },
            then(resolve) {
              resolve({ error: null });
            },
          };
          return q;
        },
      };
    },
  };
  await removeSavedJob(client, "u1", "northstar");
  assert.deepEqual(eqs, [
    { col: "user_id", val: "u1" },
    { col: "company_id", val: "northstar" },
  ]);
});

test("saved-jobs helpers propagate Supabase errors", async () => {
  const client = {
    from() {
      const q = {
        select() {
          return q;
        },
        eq() {
          return q;
        },
        then(resolve) {
          resolve({ data: null, error: new Error("db down") });
        },
      };
      return q;
    },
  };
  await assert.rejects(() => fetchSavedCompanyIds(client, "u1"), /db down/);
});

test("signInWithGoogle calls Supabase OAuth with provider google + redirect", async () => {
  let captured = null;
  const client = {
    auth: {
      signInWithOAuth(args) {
        captured = args;
        return Promise.resolve({ data: { url: "https://accounts.google.com/..." }, error: null });
      },
    },
  };
  const result = await signInWithGoogle(client, "http://localhost:3000/auth/callback");
  assert.equal(result.error, null);
  assert.equal(captured.provider, "google");
  assert.equal(captured.options.redirectTo, "http://localhost:3000/auth/callback");
});
