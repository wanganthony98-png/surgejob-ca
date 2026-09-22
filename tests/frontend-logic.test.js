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
    user: { email: "ada@ex.com", user_metadata: { full_name: "Ada Byron", avatar_url: "https://img/a.png" } },
  });
  assert.deepEqual(u, { name: "Ada Byron", email: "ada@ex.com", avatarUrl: "https://img/a.png" });

  const fallback = userFromSession({ user: { email: "grace@ex.com", user_metadata: {} } });
  assert.equal(fallback.name, "grace");
  assert.equal(fallback.avatarUrl, null);
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
