import { describe, it, expect, beforeEach } from "vitest";
import { CALDAV_STORAGE_KEY, purgeLegacyStorage } from "@/lib/storage-cleanup";

describe("storage-cleanup (C-2)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("purges legacy plaintext CalDAV credentials from localStorage", () => {
    localStorage.setItem(
      CALDAV_STORAGE_KEY,
      JSON.stringify({
        server_url: "https://dav.example.com",
        username: "user",
        password: "super-secret",
      }),
    );

    purgeLegacyStorage();

    expect(localStorage.getItem(CALDAV_STORAGE_KEY)).toBeNull();
  });

  it("is a no-op when there is nothing to purge", () => {
    expect(() => purgeLegacyStorage()).not.toThrow();
    expect(localStorage.getItem(CALDAV_STORAGE_KEY)).toBeNull();
  });
});
