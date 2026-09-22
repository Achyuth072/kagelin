import { test, expect } from "@playwright/test";

// Requires a production build (`npm run build && npm start`) — SW is off in dev.

const BASE = "http://localhost:3000";
const WASM_BYTES = 659730;

test.describe("service worker delivery of the sql.js binary", () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page, context }) => {
    await context.addCookies([
      { name: "kanso_guest_mode", value: "true", url: `${BASE}/` },
    ]);
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.evaluate(async () => {
      await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
    });
    // clientsClaim takes over this page in place; without waiting for it the
    // fetches below bypass the SW entirely and prove nothing.
    await page.waitForFunction(
      () => !!navigator.serviceWorker.controller,
      null,
      {
        timeout: 30_000,
      },
    );
  });

  test("does not precache the wasm, so a bad response cannot become permanent", async ({
    page,
  }) => {
    const precached = await page.evaluate(async () => {
      for (const name of await caches.keys()) {
        if (!name.includes("precache")) continue;
        const c = await caches.open(name);
        const hit = (await c.keys()).find((r) =>
          r.url.includes("sql-wasm.wasm"),
        );
        if (hit) return { cache: name, url: hit.url };
      }
      return null;
    });
    expect(precached, "wasm must not be in the precache manifest").toBeNull();
  });

  test("serves a binary that actually compiles", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const res = await fetch("/sql-wasm.wasm", {
        credentials: "same-origin",
      });
      const buf = await res.arrayBuffer();
      let compile = "ok";
      try {
        await WebAssembly.compile(buf);
      } catch (e) {
        compile = String(e);
      }
      return {
        status: res.status,
        contentType: res.headers.get("content-type"),
        bytes: buf.byteLength,
        // 3c 21 44 4f is '<!DO' — an HTML page compiled as wasm.
        magic: Array.from(new Uint8Array(buf.slice(0, 4)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(" "),
        compile,
      };
    });

    console.log("WASM_DELIVERY:", JSON.stringify(result));
    expect(result.magic).toBe("00 61 73 6d");
    expect(result.bytes).toBe(WASM_BYTES);
    expect(result.compile).toBe("ok");
  });

  test("recovers when the runtime cache holds a poisoned copy", async ({
    page,
  }) => {
    const poisoned = await page.evaluate(async () => {
      await fetch("/sql-wasm.wasm", { credentials: "same-origin" });
      const hit: string[] = [];
      // NetworkFirst writes the cache inside waitUntil, after the body resolves.
      const find = async () => {
        const found: [string, Request][] = [];
        for (const name of await caches.keys()) {
          const c = await caches.open(name);
          for (const key of await c.keys()) {
            if (key.url.includes("sql-wasm.wasm")) found.push([name, key]);
          }
        }
        return found;
      };
      let entries = await find();
      for (let i = 0; i < 20 && entries.length === 0; i++) {
        await new Promise((r) => setTimeout(r, 250));
        entries = await find();
      }
      for (const [name, key] of entries) {
        const c = await caches.open(name);
        await c.put(
          key,
          new Response("<!DOCTYPE html><html><body>login</body></html>", {
            status: 200,
            headers: { "content-type": "text/html" },
          }),
        );
        hit.push(name);
      }
      return hit;
    });
    console.log("POISONED_CACHES:", JSON.stringify(poisoned));
    expect(
      poisoned.length,
      "nothing was poisoned — test would be vacuous",
    ).toBeGreaterThan(0);

    const healed = await page.evaluate(async () => {
      const res = await fetch("/sql-wasm.wasm", { credentials: "same-origin" });
      const buf = await res.arrayBuffer();
      return {
        bytes: buf.byteLength,
        magic: Array.from(new Uint8Array(buf.slice(0, 4)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(" "),
      };
    });

    console.log("AFTER_POISON:", JSON.stringify(healed));
    expect(healed.magic, "NetworkFirst must prefer the network copy").toBe(
      "00 61 73 6d",
    );
    expect(healed.bytes).toBe(WASM_BYTES);
  });
});
