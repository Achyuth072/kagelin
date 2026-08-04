#!/usr/bin/env node
// TTY-only: release.cjs runs this and forwards results via CURATED_SECTIONS.
const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");
const { execFileSync } = require("child_process");
const { SECTION_ORDER, orderSections } = require("./lib/commit-types.cjs");

function isValidCuratedSections(candidate) {
  if (
    candidate === null ||
    typeof candidate !== "object" ||
    Array.isArray(candidate)
  ) {
    return false;
  }
  return Object.entries(candidate).every(
    ([section, bullets]) =>
      SECTION_ORDER.includes(section) &&
      Array.isArray(bullets) &&
      bullets.length > 0 &&
      bullets.every((b) => typeof b === "string" && b.length > 0),
  );
}

function parseCuratedSections(rawOutput) {
  const candidate = JSON.parse(rawOutput.trim());
  if (!isValidCuratedSections(candidate)) {
    throw new Error("curated output did not match the expected section shape");
  }
  return orderSections(candidate);
}

function writeChangelogEntries(changelogFile, entries) {
  fs.writeFileSync(changelogFile, JSON.stringify(entries, null, 2) + "\n");
}

function resolveChoice(answer) {
  const normalized = answer.trim().toLowerCase();
  if (normalized === "e" || normalized === "edit") return "edit";
  return "raw";
}

function editSections(sections) {
  const tmpFile = path.join(os.tmpdir(), `changelog-curate-${Date.now()}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify(sections, null, 2) + "\n");
  try {
    const editor = process.env.EDITOR || process.env.VISUAL || "vi";
    execFileSync(editor, [tmpFile], { stdio: "inherit" });
    return parseCuratedSections(fs.readFileSync(tmpFile, "utf-8"));
  } finally {
    fs.rmSync(tmpFile, { force: true });
  }
}

async function runCurationLoop(initialSections) {
  let sections = initialSections;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  // Async iterator, not rl.question(), so buffered input isn't dropped
  // between prompts.
  const lines = rl[Symbol.asyncIterator]();

  try {
    for (;;) {
      console.log("\nChangelog bullets:");
      console.log(JSON.stringify(sections, null, 2));
      process.stdout.write("[r] accept as-is  [e] edit (default r): ");

      const { value: answer, done } = await lines.next();
      if (done) return sections;

      const choice = resolveChoice(answer);
      if (choice === "raw") return sections;

      try {
        sections = editSections(sections);
      } catch (err) {
        // Deliberate fallback: a transient editor failure shouldn't crash
        // the release over a curation nicety.
        // eslint-disable-next-line no-restricted-syntax
        console.warn(`⚠ edit failed (${err.message}) — bullets unchanged.`);
      }
    }
  } finally {
    rl.close();
  }
}

module.exports = {
  parseCuratedSections,
  resolveChoice,
  runCurationLoop,
};

if (require.main === module) {
  (async () => {
    const version = process.argv[2];
    if (!version) {
      console.error("Usage: curate-changelog.cjs <version>");
      process.exit(1);
    }

    const changelogFile = path.join(process.cwd(), "public", "changelog.json");
    const entries = JSON.parse(fs.readFileSync(changelogFile, "utf-8"));
    const entry = entries.find((e) => e.version === version);

    if (!entry || Object.keys(entry.sections).length === 0) {
      return;
    }

    if (process.env.CURATED_SECTIONS) {
      try {
        entry.sections = parseCuratedSections(process.env.CURATED_SECTIONS);
        writeChangelogEntries(changelogFile, entries);
        console.log(`✓ Applied curated changelog for v${version}`);
      } catch (err) {
        // Deliberate fallback: runs unattended from release-it's after:bump
        // hook, so raw bullets beat aborting the release.
        // eslint-disable-next-line no-restricted-syntax
        console.warn(
          `⚠ Could not apply curated sections for v${version} (${err.message}) — keeping raw bullets.`,
        );
      }
      return;
    }

    if (!process.stdin.isTTY) {
      return;
    }

    entry.sections = await runCurationLoop(entry.sections);
    writeChangelogEntries(changelogFile, entries);
    console.log(`✓ Updated changelog entry for v${version}`);
  })();
}
