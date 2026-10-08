import { describe, it, expect } from "vitest";
import { readdirSync } from "fs";
import path from "path";

// Future-dated migrations break supabase db push ordering.
describe("supabase migrations", () => {
  it("are never dated in the future", () => {
    const now = new Date();
    const future = readdirSync(
      path.resolve(__dirname, "../../supabase/migrations"),
    ).filter((file) => {
      const match = file.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})_/);
      if (!match) return false;
      const [, y, mo, d, h, mi, s] = match.map(Number);
      return Date.UTC(y, mo - 1, d, h, mi, s) > now.getTime();
    });

    expect(future).toEqual([]);
  });
});
