import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useBackAnchor, useAnchoredBack } from "@/lib/hooks/useBackAnchor";
import { useRouter, usePathname } from "next/navigation";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
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
  const replaceMock = vi.fn();
  const pushMock = vi.fn();
  const backMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    delete window.__backAnchorSettled;
    vi.mocked(useRouter).mockReturnValue({
      replace: replaceMock,
      push: pushMock,
      back: backMock,
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    });
  });

  afterEach(() => {
    delete window.__backAnchorSettled;
  });

  it("handles ?redirect query param on root path by replacing with clean root and pushing target", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    setLocation("http://localhost:3000/?redirect=%2Ffocus");

    renderHook(() => useBackAnchor());

    expect(replaceMock).toHaveBeenCalledWith("/");
    expect(pushMock).toHaveBeenCalledWith("/focus");
    expect(window.__backAnchorSettled).toBe(true);
  });

  it("sanitizes unsafe external redirect params on root and does not push off-origin URLs", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    setLocation("http://localhost:3000/?redirect=https://evil.com");

    renderHook(() => useBackAnchor());

    expect(pushMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("does nothing on clean root mount", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    setLocation("http://localhost:3000/");

    renderHook(() => useBackAnchor());

    expect(replaceMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("performs synthetic replace bounce on cold non-root route without redirect param", () => {
    vi.mocked(usePathname).mockReturnValue("/focus");
    setLocation("http://localhost:3000/focus");

    const { rerender } = renderHook(() => useBackAnchor());

    expect(replaceMock).toHaveBeenCalledWith("/");
    expect(pushMock).not.toHaveBeenCalled();

    // Next render on "/"
    vi.mocked(usePathname).mockReturnValue("/");
    rerender();

    expect(pushMock).toHaveBeenCalledWith("/focus");
    expect(window.__backAnchorSettled).toBe(true);
  });

  it("skips unanchored routes like /login", () => {
    vi.mocked(usePathname).mockReturnValue("/login");
    setLocation("http://localhost:3000/login");

    renderHook(() => useBackAnchor());

    expect(replaceMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("skips /auth/update-password like /login and /signup", () => {
    vi.mocked(usePathname).mockReturnValue("/auth/update-password");
    setLocation("http://localhost:3000/auth/update-password");

    renderHook(() => useBackAnchor());

    expect(replaceMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("useAnchoredBack triggers router.back once settled", async () => {
    vi.mocked(usePathname).mockReturnValue("/");
    setLocation("http://localhost:3000/?redirect=%2Ffocus");

    renderHook(() => useBackAnchor());

    const { result } = renderHook(() => useAnchoredBack());
    result.current();

    await vi.waitFor(() => {
      expect(backMock).toHaveBeenCalledTimes(1);
    });
  });
});
