#!/usr/bin/env node
const { execFileSync } = require("child_process");
const { parseArgs } = require("node:util");
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

const USAGE = `Usage: release.cjs --channel=preview|stable [increment] [release-it flags...]

  --channel=preview|stable  required; selects the release-it config and
                             prerelease vs. stable increment logic
  --skip-validate           skip ci:validate before releasing
  [increment]               optional bare positional: patch|minor|major|
                             prepatch|preminor|premajor|prerelease|<version>
  --help, -h                show this message

Anything else is forwarded to release-it as-is (e.g. --dry-run, --ci).`;

function parseCliArgs(argv) {
  const { values, tokens } = parseArgs({
    args: argv,
    options: {
      channel: { type: "string" },
      "skip-validate": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
    tokens: true,
    strict: false,
    allowPositionals: true,
  });

  let override;
  const passthrough = [];
  for (const token of tokens) {
    if (token.kind === "option") {
      if (["channel", "skip-validate", "help"].includes(token.name)) continue;
      passthrough.push(
        token.value === undefined
          ? token.rawName
          : `${token.rawName}=${token.value}`,
      );
    } else if (token.kind === "positional") {
      if (override === undefined) {
        override = token.value;
      } else {
        passthrough.push(token.value);
      }
    }
  }

  return {
    channel: values.channel,
    skipValidate: values["skip-validate"] ?? false,
    help: values.help ?? false,
    override,
    passthrough,
  };
}

async function main() {
  const { channel, skipValidate, help, override, passthrough } = parseCliArgs(
    process.argv.slice(2),
  );

  if (help) {
    console.log(USAGE);
    return;
  }

  if (channel !== "preview" && channel !== "stable") {
    console.error(USAGE);
    process.exit(1);
  }

  const pkg = require(path.join(process.cwd(), "package.json"));
  const currentVersion = pkg.version;
  const releaseItArgs = [];
  let env = process.env;

  if (channel === "preview") {
    const midPrerelease = currentVersion.includes("-");
    if (override) {
      // semver ignores preid for non-"pre*" increments (e.g. "minor").
      const increment = BUMP_TO_PRE_INCREMENT[override] ?? override;
      releaseItArgs.push(
        "--config",
        ".release-it.json",
        increment,
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
  const releaseItBin = path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    "release-it",
  );
  try {
    execFileSync(process.execPath, [releaseItBin, ...releaseItArgs], {
      stdio: "inherit",
      env,
    });
  } catch (err) {
    process.exit(err.status ?? 1);
  }
}

main();
