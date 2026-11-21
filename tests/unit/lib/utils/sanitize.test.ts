import { describe, it, expect } from "vitest";
import { stripHtmlTags } from "@/lib/utils/sanitize";

describe("stripHtmlTags", () => {
  it("returns empty string for null, undefined, or empty string", () => {
    expect(stripHtmlTags("")).toBe("");
    expect(stripHtmlTags(null as unknown as string)).toBe("");
    expect(stripHtmlTags(undefined as unknown as string)).toBe("");
  });

  it("returns plain text unchanged", () => {
    expect(stripHtmlTags("Hello world")).toBe("Hello world");
  });

  it("strips simple html tags", () => {
    expect(stripHtmlTags("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });

  it("converts block-level tags and linebreaks into clean newlines", () => {
    expect(stripHtmlTags("<p>First paragraph</p><p>Second paragraph</p>")).toBe(
      "First paragraph\n\nSecond paragraph",
    );
    expect(stripHtmlTags("Line 1<br>Line 2<br/>Line 3<br />Line 4")).toBe(
      "Line 1\nLine 2\nLine 3\nLine 4",
    );
    expect(stripHtmlTags("<div>Block 1</div><div>Block 2</div>")).toBe(
      "Block 1\nBlock 2",
    );
  });

  it("handles list items nicely", () => {
    const html = "<ul><li>Item 1</li><li>Item 2</li></ul>";
    expect(stripHtmlTags(html)).toBe("Item 1\nItem 2");
  });

  it("decodes common HTML entities", () => {
    expect(stripHtmlTags("Rock &amp; Roll")).toBe("Rock & Roll");
    expect(
      stripHtmlTags("&quot;Quotes&quot; &lt;brackets&gt; &#39;apostrophe&#39;"),
    ).toBe("\"Quotes\" <brackets> 'apostrophe'");
    expect(stripHtmlTags("Non&nbsp;breaking&nbsp;space")).toBe(
      "Non breaking space",
    );
  });

  it("decodes decimal and hexadecimal numeric entities", () => {
    expect(stripHtmlTags("&#65;&#66;&#67;")).toBe("ABC");
    expect(stripHtmlTags("&#x41;&#x42;&#x43;")).toBe("ABC");
  });

  it("strips script and style tags and contents cleanly", () => {
    expect(stripHtmlTags("<script>alert('xss')</script>Hello")).toBe("Hello");
    expect(stripHtmlTags("<style>body { color: red; }</style>World")).toBe(
      "World",
    );
  });

  it("normalizes excessive whitespace and trims outer edges", () => {
    expect(
      stripHtmlTags("   <div>   \n\n\nHello\n\n\n\nWorld   </div>   "),
    ).toBe("Hello\n\nWorld");
  });
});
