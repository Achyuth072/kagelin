const { determineBump } = require("../../scripts/lib/determine-bump.cjs");

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
