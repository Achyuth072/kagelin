#!/usr/bin/env node
// runCurationLoop needs a TTY, so release.cjs runs it and passes the
// result here via CURATED_SECTIONS — release-it's after:bump hook has none.
const fs = require("fs");
const os = require("os");
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

function curateWithAntigravity(sections) {
  const raw = execFileSync(
    "agy",
    [
      "-p",
      buildCurationPrompt(sections),
      "--model",
      "gemini-3.5-flash",
      "--effort",
      "medium",
      "--dangerously-skip-permissions",
    ],
    { encoding: "utf-8", timeout: 90_000, stdio: ["ignore", "pipe", "pipe"] },
  );
  return parseCuratedSections(raw);
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
  // Async iterator, not rl.question(), so buffered input can't be dropped
  // between prompts.
  const lines = rl[Symbol.asyncIterator]();

  try {
    for (;;) {
      console.log("\nChangelog bullets:");
      console.log(JSON.stringify(sections, null, 2));
      process.stdout.write(
        "[a] antigravity curate  [r] accept as-is  [e] edit (default a): ",
      );

      const { value: answer, done } = await lines.next();
      if (done) return sections;

      const choice = resolveChoice(answer);
      if (choice === "raw") return sections;

      try {
        sections =
          choice === "edit"
            ? editSections(sections)
            : curateWithAntigravity(sections);
      } catch (err) {
        console.warn(
          `⚠ ${choice} failed (${err.message}) — bullets unchanged.`,
        );
      }
    }
  } finally {
    rl.close();
  }
}

module.exports = {
  buildCurationPrompt,
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
        fs.writeFileSync(
          changelogFile,
          JSON.stringify(entries, null, 2) + "\n",
        );
        console.log(`✓ Applied curated changelog for v${version}`);
      } catch (err) {
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
    fs.writeFileSync(changelogFile, JSON.stringify(entries, null, 2) + "\n");
    console.log(`✓ Updated changelog entry for v${version}`);
  })();
}
