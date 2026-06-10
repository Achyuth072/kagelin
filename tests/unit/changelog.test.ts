import { describe, it, expect, beforeEach } from "vitest";
import { useUiStore } from "@/lib/store/uiStore";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { bucketCommits } = require("../../scripts/generate-changelog.cjs");

// ---------------------------------------------------------------------------
// Generator — bucketCommits
// ---------------------------------------------------------------------------
describe("bucketCommits", () => {
  it("maps feat → Added", () => {
    expect(bucketCommits(["feat: add dark mode"])).toEqual({
      Added: ["add dark mode"],
    });
  });

  it("maps fix → Fixed", () => {
    expect(bucketCommits(["fix: resolve login crash"])).toEqual({
      Fixed: ["resolve login crash"],
    });
  });

  it("maps perf → Improved", () => {
    expect(bucketCommits(["perf: speed up sync"])).toEqual({
      Improved: ["speed up sync"],
    });
  });

  it("maps refactor → Improved", () => {
    expect(bucketCommits(["refactor: simplify timer logic"])).toEqual({
      Improved: ["simplify timer logic"],
    });
  });

  it("strips conventional-commit scope", () => {
    expect(bucketCommits(["feat(ui): add task colours"])).toEqual({
      Added: ["add task colours"],
    });
  });

  it("strips breaking-change marker", () => {
    expect(bucketCommits(["feat!: redesign API"])).toEqual({
      Added: ["redesign API"],
    });
  });

  it("strips scope and breaking-change marker together", () => {
    expect(bucketCommits(["fix(auth)!: enforce token rotation"])).toEqual({
      Fixed: ["enforce token rotation"],
    });
  });

  it("skips chore / docs / test / ci / build / style / revert", () => {
    expect(
      bucketCommits([
        "chore: update deps",
        "docs: fix README",
        "test: add unit tests",
        "ci: add workflow",
        "build: bump node",
        "style: format code",
        "revert: undo last commit",
      ]),
    ).toEqual({});
  });

  it("ignores non-conventional headings", () => {
    expect(bucketCommits(["WIP", "Merge branch main", ""])).toEqual({});
  });

  it("omits empty buckets", () => {
    const result = bucketCommits(["fix: fix a bug"]);
    expect(result).not.toHaveProperty("Added");
    expect(result).not.toHaveProperty("Improved");
    expect(result).toHaveProperty("Fixed");
  });

  it("accumulates multiple items per bucket", () => {
    const result = bucketCommits([
      "feat: feature one",
      "feat: feature two",
      "fix: fix one",
    ]);
    expect(result.Added).toHaveLength(2);
    expect(result.Fixed).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Cache — filterForDisplay + latestVisibleVersion
// ---------------------------------------------------------------------------
describe("filterForDisplay", async () => {
  const { filterForDisplay } = await import("@/lib/changelog-cache");

  const previewEntries = Array.from({ length: 20 }, (_, i) => ({
    version: `1.19.2-preview.${i}`,
    date: "2026-05-01",
    channel: "preview" as const,
    sections: { Added: [`item ${i}`] },
  }));
  const stableEntries = [
    {
      version: "1.21.0",
      date: "2026-05-28",
      channel: "stable" as const,
      sections: { Added: ["a"] },
    },
    {
      version: "1.20.1",
      date: "2026-05-20",
      channel: "stable" as const,
      sections: { Improved: ["b"] },
    },
    {
      version: "1.19.0",
      date: "2026-04-01",
      channel: "stable" as const,
      sections: { Fixed: ["c"] },
    },
    {
      version: "1.18.0",
      date: "2026-03-01",
      channel: "stable" as const,
      sections: { Fixed: ["d"] },
    },
  ];
  const mixed = [...stableEntries.slice(0, 2), ...previewEntries];

  it("preview channel: shows all, capped at 15", () => {
    const result = filterForDisplay(mixed, "preview");
    expect(result.length).toBeLessThanOrEqual(15);
  });

  it("stable channel: shows only stable entries, capped at 3", () => {
    const result = filterForDisplay(mixed, "stable");
    expect(result.every((e) => e.channel === "stable")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(3);
  });
});

describe("latestVisibleVersion", async () => {
  const { latestVisibleVersion } = await import("@/lib/changelog-cache");

  const entries = [
    {
      version: "1.21.0",
      date: "2026-05-28",
      channel: "stable" as const,
      sections: {},
    },
    {
      version: "1.19.2-preview.1",
      date: "2026-05-01",
      channel: "preview" as const,
      sections: {},
    },
  ];

  it("returns first visible entry in preview channel", () => {
    expect(latestVisibleVersion(entries, "preview")).toBe("1.21.0");
  });

  it("returns first stable entry in stable channel", () => {
    expect(latestVisibleVersion(entries, "stable")).toBe("1.21.0");
  });

  it("skips preview entries in stable channel", () => {
    const previewFirst = [entries[1], entries[0]]; // preview before stable
    expect(latestVisibleVersion(previewFirst, "stable")).toBe("1.21.0");
  });

  it("returns null for empty array", () => {
    expect(latestVisibleVersion([], "stable")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Store — version tracking (unchanged)
// ---------------------------------------------------------------------------
describe("Changelog version tracking", () => {
  beforeEach(() => {
    useUiStore.setState({ lastSeenVersion: "", lastDismissedVersion: "" });
  });

  it("should initialize with empty dismissed version on first visit", () => {
    expect(useUiStore.getState().lastDismissedVersion).toBe("");
  });

  it("should set dismissed version on dismiss", () => {
    useUiStore.getState().setLastDismissedVersion("1.19.2-preview.13");
    expect(useUiStore.getState().lastDismissedVersion).toBe(
      "1.19.2-preview.13",
    );
  });

  it("should treat empty dismissed version as first visit (no popup)", () => {
    expect(useUiStore.getState().lastDismissedVersion === "").toBe(true);
  });

  it("should detect new version when dismissed version is behind current", () => {
    useUiStore.setState({ lastDismissedVersion: "1.19.2-preview.10" });
    const dismissed = useUiStore.getState().lastDismissedVersion;
    expect(dismissed !== "1.19.2-preview.13" && dismissed !== "").toBe(true);
  });

  it("should not detect new version when dismissed matches current", () => {
    useUiStore.setState({ lastDismissedVersion: "1.19.2-preview.13" });
    const dismissed = useUiStore.getState().lastDismissedVersion;
    expect(dismissed !== "1.19.2-preview.13" && dismissed !== "").toBe(false);
  });

  it("should migrate lastSeenVersion to lastDismissedVersion", () => {
    useUiStore.setState({
      lastSeenVersion: "1.19.2-preview.10",
      lastDismissedVersion: "",
    });
    const state = useUiStore.getState();
    if (state.lastSeenVersion && !state.lastDismissedVersion) {
      state.setLastDismissedVersion(state.lastSeenVersion);
    }
    expect(useUiStore.getState().lastDismissedVersion).toBe(
      "1.19.2-preview.10",
    );
  });
});

// ---------------------------------------------------------------------------
// isNewerThan (unchanged)
// ---------------------------------------------------------------------------
describe("isNewerThan", async () => {
  const { isNewerThan } = await import("@/lib/changelog-cache");

  it("should return true when first version is newer", () => {
    expect(isNewerThan("1.19.2-preview.13", "1.19.2-preview.10")).toBe(true);
  });

  it("should return false when versions are equal", () => {
    expect(isNewerThan("1.19.2-preview.13", "1.19.2-preview.13")).toBe(false);
  });

  it("should return false when first version is older", () => {
    expect(isNewerThan("1.19.2-preview.10", "1.19.2-preview.13")).toBe(false);
  });

  it("should handle version comparison with different minor versions", () => {
    expect(isNewerThan("1.20.0", "1.19.2-preview.13")).toBe(true);
  });
});
