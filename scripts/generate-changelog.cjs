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
//
// Preview releases: a new entry is auto-generated from conventional commits
// since the last tag and inserted below "Unreleased", which is left untouched.
//
// Stable releases: the hand-written "Unreleased" entry is promoted to the new
// version, and a fresh empty "Unreleased" entry is prepended.
// ---------------------------------------------------------------------------
if (require.main === module) {
  const channelArg = process.argv.find((a) =>
    /^--channel=(preview|stable)$/.test(a),
  );
  const positional = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const [version, date = new Date().toISOString().split("T")[0]] = positional;

  if (!version) {
    console.error(
      "Usage: generate-changelog.cjs <version> [date] [--channel=preview|stable]",
    );
    console.error("  <version>           Version string (e.g. 1.22.0)");
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
  const entries = JSON.parse(fs.readFileSync(changelogFile, "utf-8"));

  const versionFile = path.join(
    process.cwd(),
    "public",
    "changelog-version.json",
  );
  const MAX_ENTRIES = 50;

  if (resolvedChannel === "preview") {
    function exec(cmd) {
      return execSync(cmd, {
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      }).trim();
    }

    let lastTag = "";
    try {
      lastTag = exec("git describe --tags --abbrev=0");
    } catch {
      // No tags yet — fall back to the full history.
    }
    const range = lastTag ? `${lastTag}..HEAD` : "HEAD";

    const rawSubjects = exec(
      `git log "${range}" --format="%s" --no-merges` +
        ` -- . ":(exclude).planning" ":(exclude).agent" ":(exclude).gemini" ":(exclude).husky" ":(exclude).vercelignore"`,
    );
    const headings = rawSubjects
      .split("\n")
      .filter(Boolean)
      .filter(
        (s) => !/^chore: .*release/.test(s) && !/^merge: sync release/.test(s),
      );

    const sections = bucketCommits(headings);

    // Insert below "Unreleased" (index 0), which is left untouched.
    const insertAt = entries[0]?.version === "Unreleased" ? 1 : 0;
    entries.splice(insertAt, 0, {
      version,
      date,
      channel: resolvedChannel,
      sections,
    });

    console.log(
      `✓ Added preview entry for v${version} (${headings.length} commits → ${Object.values(sections).flat().length} visible items)`,
    );
  } else {
    const unreleased = entries.find((e) => e.version === "Unreleased");
    if (!unreleased) {
      console.error(
        'No "Unreleased" entry found in public/changelog.json — add one with the notes for this release before bumping.',
      );
      process.exit(1);
    }

    unreleased.version = version;
    unreleased.date = date;
    unreleased.channel = resolvedChannel;

    entries.unshift({
      version: "Unreleased",
      date: null,
      channel: "preview",
      sections: {},
    });

    console.log(`✓ Promoted Unreleased → ${resolvedChannel} v${version}`);
  }

  const trimmed = entries.slice(0, MAX_ENTRIES);

  fs.writeFileSync(changelogFile, JSON.stringify(trimmed, null, 2) + "\n");
  fs.writeFileSync(
    versionFile,
    JSON.stringify({ version, channel: resolvedChannel }) + "\n",
  );
}
