const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const {
  isPreReleaseTag,
  selectLastTag,
  getLastTag,
} = require("../../scripts/lib/git-commits.cjs");

describe("isPreReleaseTag", () => {
  it("flags preview and rc suffixes", () => {
    expect(isPreReleaseTag("v1.24.0-preview.14")).toBe(true);
    expect(isPreReleaseTag("v1.24.0-rc.0")).toBe(true);
  });

  it("does not flag plain stable tags", () => {
    expect(isPreReleaseTag("v1.25.0")).toBe(false);
  });
});

describe("selectLastTag", () => {
  const tags = ["v1.25.0-preview.2", "v1.25.0-preview.1", "v1.24.0"];

  it("returns the newest tag when not excluding prereleases", () => {
    expect(selectLastTag(tags)).toBe("v1.25.0-preview.2");
  });

  it("skips preview tags to find the last stable tag", () => {
    expect(selectLastTag(tags, { excludePreRelease: true })).toBe("v1.24.0");
  });

  it("returns null when the list is empty", () => {
    expect(selectLastTag([])).toBeNull();
    expect(selectLastTag([], { excludePreRelease: true })).toBeNull();
  });

  it("returns null when excluding prereleases but only preview tags exist", () => {
    expect(
      selectLastTag(["v1.0.0-preview.0"], { excludePreRelease: true }),
    ).toBeNull();
  });
});

describe("getLastTag", () => {
  let cwd;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "git-commits-test-"));
    execFileSync("git", ["init", "-q"], { cwd });
    execFileSync("git", ["config", "user.email", "test@test.com"], { cwd });
    execFileSync("git", ["config", "user.name", "test"], { cwd });
    const commitAndTag = (message, tag) => {
      execFileSync("git", ["commit", "-q", "--allow-empty", "-m", message], {
        cwd,
      });
      execFileSync("git", ["tag", tag], { cwd });
    };
    commitAndTag("c1", "v1.43.0");
    commitAndTag("c2", "v1.43.1-preview.0");
    commitAndTag("c3", "v1.43.1");
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("treats a preview tag as older than the stable tag it preceded", () => {
    expect(getLastTag({ cwd })).toBe("v1.43.1");
  });

  it("skips preview tags to find the last stable tag", () => {
    expect(getLastTag({ cwd, excludePreRelease: true })).toBe("v1.43.1");
  });
});
