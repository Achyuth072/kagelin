const {
  isMinorOrMajorRelease,
  resolveTargetVersion,
  formatDiscussionTitle,
  formatDiscussionBody,
  resolveDiscussionChoice,
  parseDiscussionContent,
  runDiscussionCurationLoop,
  getRepoInfo,
  createGitHubDiscussion,
} = require("../../scripts/lib/github-discussion.cjs");

describe("isMinorOrMajorRelease", () => {
  it("returns true for minor and major keyword increments", () => {
    expect(isMinorOrMajorRelease("1.48.1", "minor")).toBe(true);
    expect(isMinorOrMajorRelease("1.48.1", "major")).toBe(true);
    expect(isMinorOrMajorRelease("1.48.1", "preminor")).toBe(true);
    expect(isMinorOrMajorRelease("1.48.1", "premajor")).toBe(true);
  });

  it("returns false for patch, prepatch, and prerelease increments", () => {
    expect(isMinorOrMajorRelease("1.48.1", "patch")).toBe(false);
    expect(isMinorOrMajorRelease("1.48.1", "prepatch")).toBe(false);
    expect(isMinorOrMajorRelease("1.48.1", "prerelease")).toBe(false);
  });

  it("evaluates concrete semver target versions", () => {
    expect(isMinorOrMajorRelease("1.48.1", "1.49.0")).toBe(true);
    expect(isMinorOrMajorRelease("1.48.1", "2.0.0")).toBe(true);
    expect(isMinorOrMajorRelease("1.48.1", "1.48.2")).toBe(false);
  });

  it("returns false on invalid or missing increment", () => {
    expect(isMinorOrMajorRelease("1.48.1", null)).toBe(false);
    expect(isMinorOrMajorRelease("1.48.1", "")).toBe(false);
    expect(isMinorOrMajorRelease("1.48.1", "unknown")).toBe(false);
  });
});

describe("resolveTargetVersion", () => {
  it("increments minor and major versions", () => {
    expect(resolveTargetVersion("1.48.1", "minor")).toBe("1.49.0");
    expect(resolveTargetVersion("1.48.1", "major")).toBe("2.0.0");
  });

  it("returns explicit semver versions directly", () => {
    expect(resolveTargetVersion("1.48.1", "1.50.0")).toBe("1.50.0");
  });
});

describe("resolveDiscussionChoice", () => {
  it("resolves default and accept variants", () => {
    expect(resolveDiscussionChoice("")).toBe("accept");
    expect(resolveDiscussionChoice("a")).toBe("accept");
    expect(resolveDiscussionChoice("accept")).toBe("accept");
  });

  it("resolves edit variants", () => {
    expect(resolveDiscussionChoice("e")).toBe("edit");
    expect(resolveDiscussionChoice("edit")).toBe("edit");
  });

  it("resolves skip variants", () => {
    expect(resolveDiscussionChoice("s")).toBe("skip");
    expect(resolveDiscussionChoice("skip")).toBe("skip");
  });
});

describe("parseDiscussionContent", () => {
  it("extracts markdown h1 header as title and rest as body", () => {
    const raw = `# Release v1.49.0: Guided onboarding\n\nKagelin v1.49.0 is now live!\n\n### What's New`;
    const parsed = parseDiscussionContent(raw, "Release v1.49.0");
    expect(parsed.title).toBe("Release v1.49.0: Guided onboarding");
    expect(parsed.body).toContain("Kagelin v1.49.0 is now live!");
    expect(parsed.body).not.toContain("# Release v1.49.0: Guided onboarding");
  });

  it("extracts Title: prefix as title and rest as body", () => {
    const raw = `Title: Release v1.49.0: New stuff\n\nBody content here`;
    const parsed = parseDiscussionContent(raw, "Release v1.49.0");
    expect(parsed.title).toBe("Release v1.49.0: New stuff");
    expect(parsed.body).toContain("Body content here");
  });

  it("defaults title when no header is present", () => {
    const raw = `Just regular markdown body text`;
    const parsed = parseDiscussionContent(raw, "Release v1.49.0");
    expect(parsed.title).toBe("Release v1.49.0");
    expect(parsed.body).toContain("Just regular markdown body text");
  });
});

describe("runDiscussionCurationLoop", () => {
  function makeMockRl(answers) {
    let index = 0;
    return {
      [Symbol.asyncIterator]() {
        return {
          async next() {
            if (index < answers.length) {
              return { value: answers[index++], done: false };
            }
            return { value: undefined, done: true };
          },
        };
      },
    };
  }

  it("returns content on accept-as-is", async () => {
    const mockRl = makeMockRl(["a"]);
    const result = await runDiscussionCurationLoop({
      version: "1.49.0",
      sections: { Added: ["Feature 1"] },
      rlInterface: mockRl,
    });

    expect(result.skip).toBe(false);
    expect(result.title).toBe("Release v1.49.0");
    expect(result.body).toContain("Feature 1");
  });

  it("returns skip: true on skip choice", async () => {
    const mockRl = makeMockRl(["s"]);
    const result = await runDiscussionCurationLoop({
      version: "1.49.0",
      sections: { Added: ["Feature 1"] },
      rlInterface: mockRl,
    });

    expect(result.skip).toBe(true);
  });

  it("applies edits and accepts", async () => {
    const mockRl = makeMockRl(["e", "a"]);
    const mockEditFn = vi.fn(() => ({
      title: "Release v1.49.0: Custom Title",
      body: "Custom body content\n",
    }));

    const result = await runDiscussionCurationLoop({
      version: "1.49.0",
      sections: { Added: ["Feature 1"] },
      rlInterface: mockRl,
      editFn: mockEditFn,
    });

    expect(mockEditFn).toHaveBeenCalled();
    expect(result.skip).toBe(false);
    expect(result.title).toBe("Release v1.49.0: Custom Title");
    expect(result.body).toBe("Custom body content\n");
  });
});

describe("formatDiscussionTitle", () => {
  it("defaults to Release v<version>", () => {
    expect(formatDiscussionTitle("1.49.0")).toBe("Release v1.49.0");
  });

  it("appends titleSuffix when provided", () => {
    expect(
      formatDiscussionTitle(
        "1.49.0",
        "Guided onboarding and keyboard shortcuts",
      ),
    ).toBe("Release v1.49.0: Guided onboarding and keyboard shortcuts");
  });

  it("ignores whitespace-only titleSuffix", () => {
    expect(formatDiscussionTitle("1.49.0", "   ")).toBe("Release v1.49.0");
  });
});

describe("formatDiscussionBody", () => {
  it("formats sections in Added, Improved, Fixed order without marketing fluff", () => {
    const sections = {
      Fixed: ["Bug in guest calendar"],
      Added: ["Tutorial project", "Logbook pagination"],
      Improved: ["Quiet telemetry prompt"],
    };

    const body = formatDiscussionBody("1.49.0", sections);

    expect(body).toContain("Kagelin v1.49.0 is now available!");
    expect(body).toContain("### What's New");
    expect(body).toContain(
      "#### Added\n\n- Tutorial project\n- Logbook pagination",
    );
    expect(body).toContain("#### Improved\n\n- Quiet telemetry prompt");
    expect(body).toContain("#### Fixed\n\n- Bug in guest calendar");
    expect(body).toContain("### Feedback");
    expect(body).toContain(
      "Try the update at [app.kagelin.app](https://app.kagelin.app/)",
    );
  });

  it("handles empty sections gracefully", () => {
    const body = formatDiscussionBody("1.49.0", {});
    expect(body).toContain("Kagelin v1.49.0 is now available!");
    expect(body).toContain("_No user-facing changes in this build._");
    expect(body).toContain("### Feedback");
  });
});

describe("getRepoInfo", () => {
  it("parses owner and repo from https git remote URL", () => {
    const mockExec = () => "https://github.com/Achyuth072/kagelin.git\n";
    expect(getRepoInfo(mockExec)).toEqual({
      owner: "Achyuth072",
      repo: "kagelin",
    });
  });

  it("parses owner and repo from ssh git remote URL", () => {
    const mockExec = () => "git@github.com:Achyuth072/kagelin.git\n";
    expect(getRepoInfo(mockExec)).toEqual({
      owner: "Achyuth072",
      repo: "kagelin",
    });
  });

  it("falls back to default repository info on error", () => {
    const mockExec = () => {
      throw new Error("fatal: not a git repo");
    };
    expect(getRepoInfo(mockExec)).toEqual({
      owner: "Achyuth072",
      repo: "kagelin",
    });
  });
});

describe("createGitHubDiscussion", () => {
  it("skips discussion creation when dryRun is true", () => {
    const mockExec = vi.fn();
    const result = createGitHubDiscussion({
      version: "1.49.0",
      sections: { Added: ["New feature"] },
      dryRun: true,
      execFn: mockExec,
    });

    expect(result).toEqual({
      dryRun: true,
      title: "Release v1.49.0",
      body: expect.stringContaining("Kagelin v1.49.0 is now available!"),
    });
    expect(mockExec).not.toHaveBeenCalled();
  });

  it("uses custom title and body when provided", () => {
    const mockExec = vi.fn();
    const result = createGitHubDiscussion({
      version: "1.49.0",
      title: "Custom Title",
      body: "Custom Body",
      dryRun: true,
      execFn: mockExec,
    });

    expect(result).toEqual({
      dryRun: true,
      title: "Custom Title",
      body: "Custom Body",
    });
  });

  it("queries category and creates discussion via gh graphql", () => {
    const calls = [];
    const mockExec = vi.fn((cmd, args) => {
      calls.push({ cmd, args });
      if (
        args.some((a) => a.includes("query($owner: String!, $repo: String!)"))
      ) {
        return JSON.stringify({
          data: {
            repository: {
              id: "REPO_123",
              discussionCategory: { id: "CAT_456" },
            },
          },
        });
      }
      if (
        args.some((a) =>
          a.includes(
            "mutation($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!)",
          ),
        )
      ) {
        return JSON.stringify({
          data: {
            createDiscussion: {
              discussion: {
                id: "DISC_789",
                number: 228,
                url: "https://github.com/Achyuth072/kagelin/discussions/228",
                title: "Release v1.49.0",
              },
            },
          },
        });
      }
      return "{}";
    });

    const result = createGitHubDiscussion({
      version: "1.49.0",
      sections: { Added: ["New feature"] },
      dryRun: false,
      execFn: mockExec,
    });

    expect(result).toEqual({
      id: "DISC_789",
      number: 228,
      url: "https://github.com/Achyuth072/kagelin/discussions/228",
      title: "Release v1.49.0",
    });
    expect(mockExec).toHaveBeenCalledTimes(3);
  });

  it("handles failure gracefully and returns null without throwing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mockExec = vi.fn(() => {
      throw new Error("gh: command not found");
    });

    const result = createGitHubDiscussion({
      version: "1.49.0",
      sections: {},
      dryRun: false,
      execFn: mockExec,
    });

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Could not create GitHub discussion for v1.49.0"),
    );
    warnSpy.mockRestore();
  });
});
