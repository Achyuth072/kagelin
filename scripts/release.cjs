#!/usr/bin/env node
// Continuing an existing prerelease series needs no explicit increment —
// release-it's own documented behavior for consecutive pre-releases. Only
// starting a *new* series (first preview after a stable cut) needs a
// pre-prefixed increment (preminor/prepatch/premajor).
const { execFileSync } = require("child_process");
const path = require("path");
const { getLastTag, getCommitSubjectsSince } = require("./lib/git-commits.cjs");
const { determineBump } = require("./lib/determine-bump.cjs");

const BUMP_TO_PRE_INCREMENT = {
  patch: "prepatch",
  minor: "preminor",
  major: "premajor",
};

function computeBump(tagOptions) {
  const lastTag = getLastTag(tagOptions);
  const subjects = getCommitSubjectsSince(lastTag);
  return determineBump(subjects) ?? "patch";
}

const args = process.argv.slice(2);
const channelArg = args.find((a) => /^--channel=(preview|stable)$/.test(a));
const channel = channelArg ? channelArg.split("=")[1] : null;
const override = args.find((a) => a !== channelArg && !a.startsWith("--"));

if (!channel) {
  console.error("Usage: release.cjs --channel=preview|stable [version]");
  process.exit(1);
}

const pkg = require(path.join(process.cwd(), "package.json"));
const currentVersion = pkg.version;
const releaseItArgs = [];

if (channel === "preview") {
  const midPrerelease = currentVersion.includes("-");
  if (midPrerelease) {
    releaseItArgs.push("--config", ".release-it.json", "--preRelease=preview");
  } else {
    const bump = computeBump();
    releaseItArgs.push(
      "--config",
      ".release-it.json",
      BUMP_TO_PRE_INCREMENT[bump],
      "--preRelease=preview",
    );
  }
} else {
  const increment = override ?? computeBump({ excludePreRelease: true });
  releaseItArgs.push("--config", ".release-it-stable.json", increment);
}

console.log(`→ release-it ${releaseItArgs.join(" ")}`);
execFileSync("npx", ["release-it", ...releaseItArgs], { stdio: "inherit" });
