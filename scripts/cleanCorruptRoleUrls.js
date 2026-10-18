/**
 * Replace missing, cross-company, or otherwise unverified open-role URLs
 * with the parent company careers page (or null when no careers page is stored).
 *
 * A role URL is kept only when it is an explicit link on the company domain
 * or a trusted ATS board for that company (greenhouse.io, lever.co,
 * ashbyhq.com, workable.com). LinkedIn /jobs/view links and unrelated
 * domains (for example Tim Hortons) are not kept.
 *
 * Usage: node scripts/cleanCorruptRoleUrls.js
 */
const { runCleanup } = require("./applyRoleUrlCleanup");

runCleanup("corrupt").catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
