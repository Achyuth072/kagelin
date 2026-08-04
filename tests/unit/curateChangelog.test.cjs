const {
  parseCuratedSections,
  resolveChoice,
} = require("../../scripts/curate-changelog.cjs");

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

  it("defaults to raw for empty/unrecognized input", () => {
    expect(resolveChoice("")).toBe("raw");
    expect(resolveChoice("whatever")).toBe("raw");
  });
});
