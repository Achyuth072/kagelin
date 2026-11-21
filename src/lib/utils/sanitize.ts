/**
 * Sanitizes and strips HTML tags, decoding HTML entities into clean plain text.
 * Zero-dependency, safe to run in SSR, Node, and browser environments.
 */
export function stripHtmlTags(html?: string | null): string {
  if (!html || typeof html !== "string") {
    return "";
  }

  let text = html;

  // Strip script and style blocks entirely
  text = text.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    "",
  );
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

  // Convert line breaks and paragraph/block closures into newlines
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p\s*>/gi, "\n\n");
  text = text.replace(/<\/(div|li|tr|h[1-6])\s*>/gi, "\n");

  // Strip remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode common named HTML entities
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");

  // Decode decimal entities (e.g. &#65;)
  text = text.replace(/&#(\d+);/g, (_, dec) => {
    try {
      return String.fromCodePoint(Number(dec));
    } catch {
      return "";
    }
  });

  // Decode hexadecimal entities (e.g. &#x41;)
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    try {
      return String.fromCodePoint(parseInt(hex, 16));
    } catch {
      return "";
    }
  });

  // Normalize line breaks and remove carriage returns
  text = text.replace(/\r\n|\r/g, "\n");

  // Split lines, trim trailing space per line
  const lines = text.split("\n").map((line) => line.trimEnd());
  text = lines.join("\n");

  // Collapse 3 or more consecutive newlines into 2
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}
