const { execFileSync } = require("child_process");

function isPreReleaseTag(tag) {
  return /-(preview|rc)/.test(tag);
}

function selectLastTag(tags, { excludePreRelease = false } = {}) {
  if (!excludePreRelease) return tags[0] ?? null;
  return tags.find((t) => !isPreReleaseTag(t)) ?? null;
}

function getLastTag({ cwd = process.cwd(), ...selectOptions } = {}) {
  let tags;
  try {
    tags = execFileSync(
      "git",
      [
        "-c",
        "versionsort.suffix=-rc",
        "-c",
        "versionsort.suffix=-preview",
        "tag",
        "--list",
        "--sort=-v:refname",
        "--merged",
        "HEAD",
      ],
      { encoding: "utf-8", cwd },
    )
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
  } catch {
    return null;
  }

  return selectLastTag(tags, selectOptions);
}

function getCommitSubjectsSince(tag) {
  const range = tag ? `${tag}..HEAD` : "HEAD";
  return execFileSync("git", ["log", range, "--no-merges", "--format=%s"], {
    encoding: "utf-8",
  })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

module.exports = {
  isPreReleaseTag,
  selectLastTag,
  getLastTag,
  getCommitSubjectsSince,
};
