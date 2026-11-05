const {
  determineBump,
  getPrereleaseTargetRank,
  shouldEscalatePrerelease,
} = require("../../scripts/lib/determine-bump.cjs");

describe("determineBump", () => {
  it("returns null when no conventional-commit subjects match", () => {
    expect(determineBump(["update readme", "wip"])).toBeNull();
  });

  it("maps fix/perf/refactor to patch", () => {
    expect(determineBump(["fix: streak off-by-one"])).toBe("patch");
    expect(determineBump(["perf: memoize list"])).toBe("patch");
    expect(determineBump(["refactor: unify habit view"])).toBe("patch");
  });

  it("maps feat to minor, outranking patch-level commits", () => {
    expect(determineBump(["fix: a", "feat: b", "perf: c"])).toBe("minor");
  });

  it("maps a breaking-change marker to major regardless of other commits", () => {
    expect(determineBump(["feat: b", "fix!: breaking change"])).toBe("major");
  });

  it("ignores non-conventional and unmapped types (docs, chore, test)", () => {
    expect(
      determineBump([
        "docs: update readme",
        "chore: bump deps",
        "test: add case",
      ]),
    ).toBeNull();
  });
});

describe("shouldEscalatePrerelease", () => {
  it("ranks versions correctly", () => {
    expect(getPrereleaseTargetRank("1.50.1-preview.0")).toBe(0);
    expect(getPrereleaseTargetRank("1.51.0-preview.0")).toBe(1);
    expect(getPrereleaseTargetRank("2.0.0-preview.0")).toBe(2);
  });

  it("escalates patch prereleases to minor when new commits include feat", () => {
    expect(shouldEscalatePrerelease("1.50.1-preview.0", "minor")).toBe(true);
    expect(shouldEscalatePrerelease("1.50.1-preview.0", "patch")).toBe(false);
  });

  it("escalates to major when breaking changes are introduced", () => {
    expect(shouldEscalatePrerelease("1.50.1-preview.0", "major")).toBe(true);
    expect(shouldEscalatePrerelease("1.51.0-preview.0", "major")).toBe(true);
    expect(shouldEscalatePrerelease("2.0.0-preview.0", "major")).toBe(false);
  });

  it("keeps prerelease track if bump is equal or lower rank", () => {
    expect(shouldEscalatePrerelease("1.51.0-preview.0", "minor")).toBe(false);
    expect(shouldEscalatePrerelease("1.51.0-preview.0", "patch")).toBe(false);
  });
});
