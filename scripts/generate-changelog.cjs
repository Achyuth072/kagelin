#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { getLastTag, getCommitSubjectsSince } = require("./lib/git-commits.cjs");
const {
  CONVENTIONAL_COMMIT_RE,
  COMMIT_TYPES,
  orderSections,
} = require("./lib/commit-types.cjs");

function channelFromVersion(v) {
  return /-(preview|rc)/.test(v) ? "preview" : "stable";
}

function buildSectionsFromCommits(subjects, { channel } = {}) {
  const sections = {};

  for (const subject of subjects) {
    const match = subject.match(CONVENTIONAL_COMMIT_RE);
    if (!match) continue;

    const [, type, , description] = match;
    const meta = COMMIT_TYPES[type];
    if (!meta) continue;
    if (channel === "stable" && meta.stableVisible === false) continue;

    const bullet = description[0].toUpperCase() + description.slice(1);
    sections[meta.section] ??= [];
    if (!sections[meta.section].includes(bullet)) {
      sections[meta.section].push(bullet);
    }
  }

  return orderSections(sections);
}

module.exports = { channelFromVersion, buildSectionsFromCommits };

// preview: since the last tag of any kind (continues the current cycle).
// stable: since the last *stable* tag, skipping preview tags cut mid-cycle,
// so a stable release aggregates the whole cycle.
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

  const lastTag = getLastTag({
    excludePreRelease: resolvedChannel === "stable",
  });
  const subjects = getCommitSubjectsSince(lastTag);
  const sections = buildSectionsFromCommits(subjects, {
    channel: resolvedChannel,
  });

  entries.unshift({
    version,
    date,
    channel: resolvedChannel,
    sections,
  });

  console.log(
    `✓ Added ${resolvedChannel} entry for v${version} (${Object.values(sections).flat().length} items from ${subjects.length} commits since ${lastTag ?? "the beginning"})`,
  );

  const trimmed = entries.slice(0, MAX_ENTRIES);

  fs.writeFileSync(changelogFile, JSON.stringify(trimmed, null, 2) + "\n");
  fs.writeFileSync(
    versionFile,
    JSON.stringify({ version, channel: resolvedChannel }) + "\n",
  );
}
