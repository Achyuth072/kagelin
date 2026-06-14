/**
 * Pick a legible foreground (black or white) for content overlaid on `hex`,
 * by the WCAG relative-luminance of the fill. Used so a completed-habit check
 * stays visible on both light fills (e.g. pale yellow) and dark ones (e.g.
 * Sumi Ink #1A1A1A), where a fixed black check would vanish.
 *
 * Accepts #rgb / #rrggbb; falls back to black for unparseable input.
 */
export function getContrastingColor(hex: string): "#000000" | "#ffffff" {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#000000";
  // Relative luminance (sRGB, per WCAG 2.x).
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.179 ? "#000000" : "#ffffff";
}

function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.replace("#", "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
