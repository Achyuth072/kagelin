import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useBackAnchor, useAnchoredBack } from "@/lib/hooks/useBackAnchor";
import { usePathname } from "next/navigation";

const { mockReplace, mockPush, mockBack } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockPush: vi.fn(),
  mockBack: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
    back: mockBack,
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: vi.fn(),
}));

function setLocation(url: string) {
  const parsed = new URL(url);
  Object.defineProperty(window, "location", {
    value: parsed,
    writable: true,
    configurable: true,
  });
}

describe("useBackAnchor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete window.__backAnchorSettled;
  });

  afterEach(() => {
    delete window.__backAnchorSettled;
  });

  it("handles ?redirect query param on root path by replacing with clean root and pushing target", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    setLocation("http://localhost:3000/?redirect=%2Ffocus");
    // router.replace("/") would be superseded by the push() below and never
    // land — see useBackAnchor.ts — so this path bypasses the router and
    // rewrites the URL directly.
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    renderHook(() => useBackAnchor());

    expect(replaceStateSpy).toHaveBeenCalledWith({}, "", "/");
    expect(mockPush).toHaveBeenCalledWith("/focus");
    expect(window.__backAnchorSettled).toBe(true);
  });

  it("sanitizes unsafe external redirect params on root and does not push off-origin URLs", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    setLocation("http://localhost:3000/?redirect=https://evil.com");

    renderHook(() => useBackAnchor());

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("does nothing on clean root mount", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    setLocation("http://localhost:3000/");

    renderHook(() => useBackAnchor());

    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("performs synthetic replace bounce on cold non-root route without redirect param", () => {
    vi.mocked(usePathname).mockReturnValue("/focus");
    setLocation("http://localhost:3000/focus");

    const { rerender } = renderHook(() => useBackAnchor());

    expect(mockReplace).toHaveBeenCalledWith("/");
    expect(mockPush).not.toHaveBeenCalled();

    // Next render on "/"
    vi.mocked(usePathname).mockReturnValue("/");
    rerender();

    expect(mockPush).toHaveBeenCalledWith("/focus");
    expect(window.__backAnchorSettled).toBe(true);
  });

  it("skips unanchored routes like /login", () => {
    vi.mocked(usePathname).mockReturnValue("/login");
    setLocation("http://localhost:3000/login");

    renderHook(() => useBackAnchor());

    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("skips /auth/update-password like /login and /signup", () => {
    vi.mocked(usePathname).mockReturnValue("/auth/update-password");
    setLocation("http://localhost:3000/auth/update-password");

    renderHook(() => useBackAnchor());

    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("useAnchoredBack triggers router.back once settled", async () => {
    vi.mocked(usePathname).mockReturnValue("/");
    setLocation("http://localhost:3000/?redirect=%2Ffocus");

    renderHook(() => useBackAnchor());

    const { result } = renderHook(() => useAnchoredBack());
    result.current();

    await vi.waitFor(() => {
      expect(mockBack).toHaveBeenCalledTimes(1);
    });
  });
});
