#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function channelFromVersion(v) {
  return /-(preview|rc)/.test(v) ? "preview" : "stable";
}

const COMMIT_TYPE_TO_SECTION = {
  feat: "Added",
  fix: "Fixed",
  perf: "Improved",
};

const SECTION_ORDER = ["Added", "Improved", "Fixed"];

const CONVENTIONAL_COMMIT_RE = /^(\w+)(?:\([^)]+\))?!?:\s*(.+)$/;

function getCommitSubjectsSinceLastTag() {
  let lastTag;
  try {
    lastTag = execFileSync("git", ["describe", "--tags", "--abbrev=0"], {
      encoding: "utf-8",
    }).trim();
  } catch {
    return [];
  }

  return execFileSync(
    "git",
    ["log", `${lastTag}..HEAD`, "--format=%s"],
    { encoding: "utf-8" },
  )
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildSectionsFromCommits(subjects) {
  const sections = {};

  for (const subject of subjects) {
    const match = subject.match(CONVENTIONAL_COMMIT_RE);
    if (!match) continue;

    const [, type, description] = match;
    const section = COMMIT_TYPE_TO_SECTION[type];
    if (!section) continue;

    const bullet = description[0].toUpperCase() + description.slice(1);
    sections[section] ??= [];
    if (!sections[section].includes(bullet)) {
      sections[section].push(bullet);
    }
  }

  const ordered = {};
  for (const section of SECTION_ORDER) {
    if (sections[section]?.length) ordered[section] = sections[section];
  }
  return ordered;
}

module.exports = { channelFromVersion, buildSectionsFromCommits };

// ---------------------------------------------------------------------------
// CLI entry — only runs when called directly, not when require()'d by tests.
//
// Preview releases: a new entry is created by copying the hand-written
// "Unreleased" section (the same curated bullets destined for the next stable
// release) and inserting it below "Unreleased", which is left untouched.
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
    const unreleased = entries[0]?.version === "Unreleased" ? entries[0] : null;
    const subjects = getCommitSubjectsSinceLastTag();
    const sections = buildSectionsFromCommits(subjects);

    // Insert below "Unreleased" (index 0), which is left untouched.
    const insertAt = unreleased ? 1 : 0;
    entries.splice(insertAt, 0, {
      version,
      date,
      channel: resolvedChannel,
      sections,
    });

    console.log(
      `✓ Added preview entry for v${version} (${Object.values(sections).flat().length} items from ${subjects.length} commits)`,
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
