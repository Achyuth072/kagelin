const { execFileSync } = require("child_process");

function isPreReleaseTag(tag) {
  return /-(preview|rc)/.test(tag);
}

function selectLastTag(tags, { excludePreRelease = false } = {}) {
  if (!excludePreRelease) return tags[0] ?? null;
  return tags.find((t) => !isPreReleaseTag(t)) ?? null;
}

function getLastTag(options) {
  let tags;
  try {
    tags = execFileSync(
      "git",
      ["tag", "--list", "--sort=-v:refname", "--merged", "HEAD"],
      { encoding: "utf-8" },
    )
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
  } catch {
    return null;
  }

  return selectLastTag(tags, options);
}

function getCommitSubjectsSince(tag) {
  const range = tag ? `${tag}..HEAD` : "HEAD";
  return execFileSync("git", ["log", range, "--format=%s"], {
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
