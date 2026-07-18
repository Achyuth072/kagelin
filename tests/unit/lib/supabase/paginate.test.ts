import { describe, it, expect, vi } from "vitest";
import { fetchAllRows } from "@/lib/supabase/paginate";

describe("fetchAllRows", () => {
  it("stops after a single page shorter than the page size", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValue({ data: [1, 2, 3], error: null });

    const rows = await fetchAllRows(fetchPage);

    expect(rows).toEqual([1, 2, 3]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("pages past the 1000-row PostgREST cap", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => i);
    const page2 = Array.from({ length: 500 }, (_, i) => 1000 + i);
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ data: page1, error: null })
      .mockResolvedValueOnce({ data: page2, error: null });

    const rows = await fetchAllRows(fetchPage);

    expect(rows).toHaveLength(1500);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 0, 999);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it("stops on an empty page instead of looping forever", async () => {
    const fetchPage = vi.fn().mockResolvedValue({ data: [], error: null });

    const rows = await fetchAllRows(fetchPage);

    expect(rows).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("throws on a page error instead of silently truncating", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(fetchAllRows(fetchPage)).rejects.toThrow("boom");
  });
});
