#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

function channelFromVersion(v) {
  return /-(preview|rc)/.test(v) ? "preview" : "stable";
}

module.exports = { channelFromVersion };

// ---------------------------------------------------------------------------
// CLI entry — only runs when called directly, not when require()'d by tests.
//
// Promotes the hand-written "Unreleased" entry in public/changelog.json to a
// real version. Release notes are written by hand as part of normal PRs, not
// generated from commit messages — see .planning/CHANGELOG-AUTOMATION.md.
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

  fs.writeFileSync(changelogFile, JSON.stringify(entries, null, 2) + "\n");

  const versionFile = path.join(
    process.cwd(),
    "public",
    "changelog-version.json",
  );
  fs.writeFileSync(
    versionFile,
    JSON.stringify({ version, channel: resolvedChannel }) + "\n",
  );

  console.log(`✓ Promoted Unreleased → ${resolvedChannel} v${version}`);
}
