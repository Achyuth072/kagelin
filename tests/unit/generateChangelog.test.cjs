const {
  channelFromVersion,
  buildSectionsFromCommits,
} = require("../../scripts/generate-changelog.cjs");

describe("channelFromVersion", () => {
  it("detects preview/rc suffixes as the preview channel", () => {
    expect(channelFromVersion("1.26.0-preview.3")).toBe("preview");
    expect(channelFromVersion("1.26.0-rc.0")).toBe("preview");
  });

  it("treats plain semver as stable", () => {
    expect(channelFromVersion("1.26.0")).toBe("stable");
  });
});

describe("buildSectionsFromCommits", () => {
  const subjects = [
    "feat: add frequency editor",
    "fix: correct streak off-by-one",
    "perf: memoize task list",
    "refactor: unify habit view",
    "docs: update readme",
    "chore: bump deps",
  ];

  it("buckets feat/fix/perf into Added/Fixed/Improved on the preview channel", () => {
    const sections = buildSectionsFromCommits(subjects, { channel: "preview" });
    expect(sections.Added).toEqual(["Add frequency editor"]);
    expect(sections.Fixed).toEqual(["Correct streak off-by-one"]);
  });

  it("includes refactor under Improved on the preview channel", () => {
    const sections = buildSectionsFromCommits(subjects, { channel: "preview" });
    expect(sections.Improved).toEqual([
      "Memoize task list",
      "Unify habit view",
    ]);
  });

  it("excludes refactor from Improved on the stable channel", () => {
    const sections = buildSectionsFromCommits(subjects, { channel: "stable" });
    expect(sections.Improved).toEqual(["Memoize task list"]);
  });

  it("drops unmapped commit types (docs, chore) on both channels", () => {
    const previewSections = buildSectionsFromCommits(subjects, {
      channel: "preview",
    });
    const stableSections = buildSectionsFromCommits(subjects, {
      channel: "stable",
    });
    const flatten = (s) => Object.values(s).flat();
    expect(flatten(previewSections).some((b) => /readme|deps/i.test(b))).toBe(
      false,
    );
    expect(flatten(stableSections).some((b) => /readme|deps/i.test(b))).toBe(
      false,
    );
  });

  it("dedupes identical bullets and orders sections Added/Improved/Fixed", () => {
    const sections = buildSectionsFromCommits(
      ["feat: add x", "feat: add x", "fix: y", "feat: add x"],
      { channel: "stable" },
    );
    expect(sections.Added).toEqual(["Add x"]);
    expect(Object.keys(sections)).toEqual(["Added", "Fixed"]);
  });
});
