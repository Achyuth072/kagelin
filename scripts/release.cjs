#!/usr/bin/env node
// Only the first preview after a stable cut needs a pre-prefixed increment;
// release-it continues an existing prerelease series on its own.
const { execFileSync } = require("child_process");
const path = require("path");
const { getLastTag, getCommitSubjectsSince } = require("./lib/git-commits.cjs");
const { determineBump } = require("./lib/determine-bump.cjs");
const { buildSectionsFromCommits } = require("./generate-changelog.cjs");
const { runCurationLoop } = require("./curate-changelog.cjs");

const BUMP_TO_PRE_INCREMENT = {
  patch: "prepatch",
  minor: "preminor",
  major: "premajor",
};

function subjectsSince(tagOptions) {
  return getCommitSubjectsSince(getLastTag(tagOptions));
}

function computeBump(subjects) {
  return determineBump(subjects) ?? "patch";
}

async function main() {
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
  let env = process.env;

  if (channel === "preview") {
    const midPrerelease = currentVersion.includes("-");
    if (midPrerelease) {
      releaseItArgs.push(
        "--config",
        ".release-it.json",
        "--preRelease=preview",
      );
    } else {
      const bump = computeBump(subjectsSince());
      releaseItArgs.push(
        "--config",
        ".release-it.json",
        BUMP_TO_PRE_INCREMENT[bump],
        "--preRelease=preview",
      );
    }
  } else {
    const subjects = subjectsSince({ excludePreRelease: true });
    const increment = override ?? computeBump(subjects);
    const rawSections = buildSectionsFromCommits(subjects, {
      channel: "stable",
    });
    const curatedSections = process.stdin.isTTY
      ? await runCurationLoop(rawSections)
      : rawSections;

    releaseItArgs.push("--config", ".release-it-stable.json", increment);
    env = {
      ...process.env,
      CURATED_SECTIONS: JSON.stringify(curatedSections),
    };
  }

  console.log(`→ release-it ${releaseItArgs.join(" ")}`);
  execFileSync("npx", ["release-it", ...releaseItArgs], {
    stdio: "inherit",
    env,
  });
}

main();
