#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const SECTION_ORDER = ["Added", "Improved", "Fixed"];

const version = process.argv[2];
if (!version) {
  console.error("Usage: release-notes.cjs <version>");
  process.exit(1);
}

const changelogFile = path.join(process.cwd(), "public", "changelog.json");
const entries = JSON.parse(fs.readFileSync(changelogFile, "utf-8"));

const entry = entries.find((e) => e.version === version);
if (!entry) {
  console.error(`No changelog entry found for version ${version}`);
  process.exit(1);
}

const lines = [];
for (const section of SECTION_ORDER) {
  const items = entry.sections[section];
  if (!items?.length) continue;
  lines.push(`### ${section}`, "");
  for (const item of items) {
    lines.push(`- ${item}`);
  }
  lines.push("");
}

process.stdout.write(lines.join("\n").trim() + "\n");
