#!/usr/bin/env node
// generate-changelog.cjs writes one bullet per commit, so a feature
// spanning several commits shows up as several bullets. Offers a choice
// per release: curate via antigravity-cli (agy), keep the raw bullets, or
// edit them by hand. Wired into .release-it-stable.json only — preview
// stays fast and raw for testers; only the stable, general-audience
// changelog gets this treatment.
//
// The choice is prompted in scripts/release.cjs, not here: release-it runs
// this as an after:bump hook via child_process.exec, which never has a TTY
// (release.cjs does, since it inherits stdio when it invokes release-it).
// The choice arrives via CURATE_CHOICE; missing/unset defaults to "raw".
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { execFileSync } = require("child_process");
const { SECTION_ORDER, orderSections } = require("./lib/commit-types.cjs");

function buildCurationPrompt(sections) {
  return [
    "You are editing a product changelog. The bullets below were generated",
    "one per commit, so several bullets often describe steps of the same",
    "user-facing change. Consolidate bullets that describe the same change",
    "into a single concise, user-facing line. Keep genuinely distinct",
    "changes as separate bullets. Do not invent content, do not move a",
    "bullet to a different section, do not drop a distinct change.",
    "",
    "Reply with ONLY valid JSON (no markdown fences, no commentary) in",
    "this exact shape, omitting any section that ends up empty:",
    JSON.stringify(sections, null, 2),
  ].join("\n");
}

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

function resolveChoice(answer) {
  const normalized = answer.trim().toLowerCase();
  if (normalized === "r" || normalized === "raw") return "raw";
  if (normalized === "e" || normalized === "edit") return "edit";
  return "antigravity";
}

function promptChoice() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(
      "Changelog curation — [a] antigravity curate  [r] raw  [e] edit (default a): ",
      (answer) => {
        rl.close();
        resolve(resolveChoice(answer));
      },
    );
  });
}

function curateWithAntigravity(changelogFile, entries, entry, version) {
  try {
    const raw = execFileSync(
      "agy",
      [
        "-p",
        buildCurationPrompt(entry.sections),
        "--model",
        "gemini-3.5-flash",
        "--effort",
        "medium",
        "--dangerously-skip-permissions",
      ],
      { encoding: "utf-8", timeout: 90_000, stdio: ["ignore", "pipe", "pipe"] },
    );

    entry.sections = parseCuratedSections(raw);
    fs.writeFileSync(changelogFile, JSON.stringify(entries, null, 2) + "\n");
    console.log(`✓ Curated changelog entry for v${version}`);
  } catch (err) {
    console.warn(
      `⚠ Antigravity curation failed for v${version} (${err.message}) — keeping raw commit-derived bullets. Edit "${version}" in ${changelogFile} by hand and push a follow-up commit if needed.`,
    );
  }
}

module.exports = {
  buildCurationPrompt,
  parseCuratedSections,
  resolveChoice,
  promptChoice,
};

if (require.main === module) {
  const version = process.argv[2];
  if (!version) {
    console.error("Usage: curate-changelog.cjs <version>");
    process.exit(1);
  }

  const changelogFile = path.join(process.cwd(), "public", "changelog.json");
  const entries = JSON.parse(fs.readFileSync(changelogFile, "utf-8"));
  const entry = entries.find((e) => e.version === version);

  if (!entry || Object.keys(entry.sections).length === 0) {
    process.exit(0);
  }

  const choice = process.env.CURATE_CHOICE ?? "raw";

  if (choice === "raw") {
    process.exit(0);
  }
  if (choice === "edit") {
    console.warn(
      `Edit chosen — update "${version}" in ${changelogFile} by hand and push a follow-up commit if needed.`,
    );
    process.exit(0);
  }
  curateWithAntigravity(changelogFile, entries, entry, version);
}
