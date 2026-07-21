const {
  buildCurationPrompt,
  parseCuratedSections,
  resolveChoice,
} = require("../../scripts/curate-changelog.cjs");

describe("buildCurationPrompt", () => {
  it("embeds the raw sections as JSON in the prompt", () => {
    const sections = { Added: ["Add x"], Fixed: ["Fix y"] };
    const prompt = buildCurationPrompt(sections);
    expect(prompt).toContain(JSON.stringify(sections, null, 2));
    expect(prompt).toContain("ONLY valid JSON");
  });
});

describe("parseCuratedSections", () => {
  it("parses and reorders valid curated JSON into Added/Improved/Fixed order", () => {
    const raw = JSON.stringify({ Fixed: ["Fix y"], Added: ["Add x"] });
    expect(parseCuratedSections(raw)).toEqual({
      Added: ["Add x"],
      Fixed: ["Fix y"],
    });
  });

  it("tolerates surrounding whitespace", () => {
    const raw = `\n  ${JSON.stringify({ Added: ["Add x"] })}  \n`;
    expect(parseCuratedSections(raw)).toEqual({ Added: ["Add x"] });
  });

  it("rejects malformed JSON", () => {
    expect(() => parseCuratedSections("not json")).toThrow();
  });

  it("rejects an unknown section key", () => {
    const raw = JSON.stringify({ Refactored: ["x"] });
    expect(() => parseCuratedSections(raw)).toThrow(
      /did not match the expected section shape/,
    );
  });

  it("rejects an empty bullet array", () => {
    const raw = JSON.stringify({ Added: [] });
    expect(() => parseCuratedSections(raw)).toThrow();
  });

  it("rejects a non-string bullet", () => {
    const raw = JSON.stringify({ Added: [42] });
    expect(() => parseCuratedSections(raw)).toThrow();
  });

  it("rejects a JSON array at the top level", () => {
    expect(() => parseCuratedSections("[]")).toThrow();
  });
});

describe("resolveChoice", () => {
  it("maps r/raw to raw", () => {
    expect(resolveChoice("r")).toBe("raw");
    expect(resolveChoice("raw")).toBe("raw");
    expect(resolveChoice("  R  ")).toBe("raw");
  });

  it("maps e/edit to edit", () => {
    expect(resolveChoice("e")).toBe("edit");
    expect(resolveChoice("Edit")).toBe("edit");
  });

  it("defaults to antigravity for a/antigravity/empty/unrecognized input", () => {
    expect(resolveChoice("a")).toBe("antigravity");
    expect(resolveChoice("antigravity")).toBe("antigravity");
    expect(resolveChoice("")).toBe("antigravity");
    expect(resolveChoice("whatever")).toBe("antigravity");
  });
});
