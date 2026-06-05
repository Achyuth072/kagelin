#!/usr/bin/env node
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Shared bucketing logic — exported so tests and the migration script can
// import it without running the git/file logic below.
// ---------------------------------------------------------------------------
const BUCKET = { feat: "Added", fix: "Fixed", perf: "Improved", refactor: "Improved" };
const SKIP = new Set(["chore", "docs", "test", "ci", "build", "style", "revert"]);
// Captures:  type  scope?  !?  :  message
const CC = /^(\w+)(?:\([^)]*\))?!?:\s*(.+)$/;

function bucketCommits(headings) {
  const sections = { Added: [], Improved: [], Fixed: [] };
  for (const heading of headings) {
    const m = heading.match(CC);
    if (!m) continue;
    const [, type, message] = m;
    if (SKIP.has(type)) continue;
    const bucket = BUCKET[type];
    if (!bucket) continue;
    sections[bucket].push(message.trim());
  }
  return Object.fromEntries(
    Object.entries(sections).filter(([, v]) => v.length > 0),
  );
}

function channelFromVersion(v) {
  return /-(preview|rc)/.test(v) ? "preview" : "stable";
}

module.exports = { bucketCommits, channelFromVersion };

// ---------------------------------------------------------------------------
// CLI entry — only runs when called directly, not when require()'d by tests.
// ---------------------------------------------------------------------------
if (require.main === module) {
  const version = process.argv[2];
  const channel = process.argv[3] && /^(preview|stable)$/.test(process.argv[3])
    ? process.argv[3]
    : null;
  // If argv[3] was consumed as channel, shift the rest; otherwise keep positions.
  const argOffset = channel !== null ? 1 : 0;
  const since = process.argv[3 + argOffset];
  const until = process.argv[4 + argOffset] || "HEAD";
  const date = process.argv[5 + argOffset] || new Date().toISOString().split("T")[0];

  if (!version || !since) {
    console.error(
      "Usage: generate-changelog.cjs <version> [channel] <since> [until] [date]",
    );
    console.error("  <version>   Version string (e.g. 1.22.0-preview.1)");
    console.error("  [channel]   'preview' or 'stable' (auto-detected from version if omitted)");
    console.error("  <since>     Git ref to start log from (e.g. <prev_release_hash>)");
    console.error("  [until]     Optional end ref (defaults to HEAD)");
    console.error("  [date]      Optional date (defaults to today)");
    process.exit(1);
  }

  const resolvedChannel = channel ?? channelFromVersion(version);

  const changelogFile = path.join(process.cwd(), "public", "changelog.json");
  fs.mkdirSync(path.dirname(changelogFile), { recursive: true });

  function exec(cmd) {
    return execSync(cmd, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    }).trim();
  }

  const hashes = exec(
    `git log "${since}..${until}" --format="%H" --no-merges` +
      ` -- . ":(exclude).planning" ":(exclude).agent" ":(exclude).gemini" ":(exclude).husky" ":(exclude).vercelignore"`,
  )
    .split("\n")
    .filter(Boolean);

  const headings = [];

  for (const hash of hashes) {
    const subject = exec(`git log -1 --format="%s" "${hash}"`);
    if (/^chore: .*release/.test(subject)) continue;
    if (/^merge: sync release/.test(subject)) continue;
    headings.push(subject);
  }

  const sections = bucketCommits(headings);

  if (resolvedChannel === "stable") {
    console.log("");
    console.log("╔══════════════════════════════════════════════════════╗");
    console.log("║  STABLE RELEASE — hand-polish the sections below    ║");
    console.log("║  in public/changelog.json before tagging the release ║");
    console.log("╚══════════════════════════════════════════════════════╝");
    console.log("");
  }

  let entries = [];
  if (fs.existsSync(changelogFile)) {
    try {
      entries = JSON.parse(fs.readFileSync(changelogFile, "utf-8"));
    } catch {
      console.warn("Warning: could not parse existing changelog.json, starting fresh");
    }
  }

  entries.unshift({ version, date, channel: resolvedChannel, sections });

  fs.writeFileSync(changelogFile, JSON.stringify(entries, null, 2) + "\n");
  console.log(
    `✓ Added ${resolvedChannel} entry for v${version} (${headings.length} commits → ${Object.values(sections).flat().length} visible items)`,
  );
}
