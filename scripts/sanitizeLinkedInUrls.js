/**
 * Replace LinkedIn AuthWall job links on open roles.
 * linkedin.com/jobs/view URLs are logged-out "Recommended Jobs" and are not
 * safe apply links. Each one is rewritten to the parent company careers page
 * (or website) when that page is on file, otherwise null.
 *
 * Usage: node scripts/sanitizeLinkedInUrls.js
 */
const { runCleanup } = require("./applyRoleUrlCleanup");

runCleanup("linkedin").catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
