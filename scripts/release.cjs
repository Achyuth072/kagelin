#!/usr/bin/env node
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
  const skipValidate = args.includes("--skip-validate");
  const consumed = new Set([channelArg, "--skip-validate"].filter(Boolean));
  const override = args.find((a) => !consumed.has(a) && !a.startsWith("--"));
  const passthrough = args.filter((a) => a !== override && !consumed.has(a));

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
    if (override) {
      releaseItArgs.push(
        "--config",
        ".release-it.json",
        override,
        "--preRelease=preview",
      );
    } else if (midPrerelease) {
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

  if (skipValidate) {
    console.warn(
      "⚠ --skip-validate: bypassing typecheck/lint/test/build before this release.",
    );
    releaseItArgs.push("--hooks.before:init=");
  }

  releaseItArgs.push(...passthrough);

  console.log(`→ release-it ${releaseItArgs.join(" ")}`);
  execFileSync("npx", ["release-it", ...releaseItArgs], {
    stdio: "inherit",
    env,
  });
}

main();
