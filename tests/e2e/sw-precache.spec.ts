import { test, expect } from "@playwright/test";

// Regression: /sql-wasm.wasm was gated by the Supabase session proxy, so the
// service worker precached a redirect to /login instead of the binary and the
// import failed with "Ensure it is a valid .db file".
// Requires a production build (`npm run build && npm start`) — the SW is
// disabled in dev.
test("service worker precaches the real wasm binary", async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  await context.addCookies([
    { name: "kanso_guest_mode", value: "true", url: "http://localhost:3000/" },
  ]);
  await page.goto("http://localhost:3000/login", {
    waitUntil: "domcontentloaded",
  });

  const state = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 50; i++) {
      const names = await caches.keys();
      for (const n of names) {
        const c = await caches.open(n);
        const keys = await c.keys();
        const hit = keys.find((r) => r.url.includes("sql-wasm.wasm"));
        if (hit) {
          const res = await c.match(hit);
          const buf = await res!.arrayBuffer();
          const magic = Array.from(new Uint8Array(buf.slice(0, 4)))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(" ");
          return {
            found: true,
            cache: n,
            url: hit.url,
            bytes: buf.byteLength,
            magic,
            contentType: res!.headers.get("content-type"),
          };
        }
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    return { found: false, scope: reg.scope, caches: await caches.keys() };
  });

  console.log("SW_PRECACHE:", JSON.stringify(state, null, 2));
  expect(state.found).toBe(true);
  expect(state.magic).toBe("00 61 73 6d"); // wasm magic, NOT 3c 21 44 4f ('<!DO')
});
