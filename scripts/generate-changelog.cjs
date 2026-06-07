#!/usr/bin/env node
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Shared bucketing logic — exported so tests can import without running CLI.
// ---------------------------------------------------------------------------
const BUCKET = {
  feat: "Added",
  fix: "Fixed",
  perf: "Improved",
  refactor: "Improved",
};
const SKIP = new Set([
  "chore",
  "docs",
  "test",
  "ci",
  "build",
  "style",
  "revert",
]);
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
  // Named flag: --channel=preview | --channel=stable (optional; auto-detected otherwise)
  const channelArg = process.argv.find((a) =>
    /^--channel=(preview|stable)$/.test(a),
  );
  const positional = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const [
    version,
    since,
    until = "HEAD",
    date = new Date().toISOString().split("T")[0],
  ] = positional;

  if (!version || !since) {
    console.error(
      "Usage: generate-changelog.cjs <version> <since> [until] [date] [--channel=preview|stable]",
    );
    console.error("  <version>           Version string (e.g. 1.22.0)");
    console.error(
      "  <since>             Git ref to start log from (e.g. <prev-tag>)",
    );
    console.error("  [until]             End ref (defaults to HEAD)");
    console.error("  [date]              Date (defaults to today)");
    console.error(
      "  [--channel=stable]  Override channel (auto-detected from version if omitted)",
    );
    process.exit(1);
  }

  const resolvedChannel = channelArg
    ? channelArg.split("=")[1]
    : channelFromVersion(version);

  const changelogFile = path.join(process.cwd(), "public", "changelog.json");
  fs.mkdirSync(path.dirname(changelogFile), { recursive: true });

  function exec(cmd) {
    return execSync(cmd, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    }).trim();
  }

  // Single git log call — get all subjects at once instead of one exec per hash.
  const rawSubjects = exec(
    `git log "${since}..${until}" --format="%s" --no-merges` +
      ` -- . ":(exclude).planning" ":(exclude).agent" ":(exclude).gemini" ":(exclude).husky" ":(exclude).vercelignore"`,
  );
  const headings = rawSubjects
    .split("\n")
    .filter(Boolean)
    .filter(
      (s) => !/^chore: .*release/.test(s) && !/^merge: sync release/.test(s),
    );

  const sections = bucketCommits(headings);

  if (resolvedChannel === "stable") {
    console.log(
      "\n╔══════════════════════════════════════════════════════╗\n" +
        "║  STABLE RELEASE — hand-polish the sections below    ║\n" +
        "║  in public/changelog.json before tagging the release ║\n" +
        "╚══════════════════════════════════════════════════════╝\n",
    );
  }

  let entries = [];
  if (fs.existsSync(changelogFile)) {
    try {
      entries = JSON.parse(fs.readFileSync(changelogFile, "utf-8"));
    } catch {
      console.warn(
        "Warning: could not parse existing changelog.json, starting fresh",
      );
    }
  }

  entries.unshift({ version, date, channel: resolvedChannel, sections });

  fs.writeFileSync(changelogFile, JSON.stringify(entries, null, 2) + "\n");
  console.log(
    `✓ Added ${resolvedChannel} entry for v${version} (${headings.length} commits → ${Object.values(sections).flat().length} visible items)`,
  );
}
