import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import React from "react";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
      return <div {...props}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

function renderOffline() {
  render(<OfflineIndicator />);
  const wrapper = screen.getByTestId("offline-indicator");
  const card = wrapper.firstElementChild as HTMLElement;
  return { wrapper, card };
}

describe("OfflineIndicator placement", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });
  });

  it("is a slim full-width strip pinned under the mobile header", () => {
    const { wrapper, card } = renderOffline();

    expect(wrapper.className).toContain("fixed");
    expect(wrapper.className).toContain("inset-x-0");
    expect(wrapper.className).toContain(
      "top-[var(--offline-banner-top,var(--mobile-header-height))]",
    );
    expect(card.className).toContain("h-[var(--offline-banner-height)]");
    expect(card.className).toContain("w-full");
    expect(card.className).toContain("border-b");
  });

  it("is a pill centred in the content column on desktop", () => {
    const { wrapper, card } = renderOffline();

    expect(wrapper.className).toContain("md:absolute");
    expect(wrapper.className).toContain("md:top-auto");
    expect(wrapper.className).toContain("md:bottom-6");
    expect(wrapper.className).toContain("md:justify-center");
    expect(card.className).toContain("md:w-auto");
    expect(card.className).toContain("md:rounded-lg");
    expect(card.className).toContain("md:border");
  });

  it("never positions itself from --sidebar-width", () => {
    const { wrapper } = renderOffline();

    expect(wrapper.className).not.toContain("--sidebar-width");
  });

  it("renders each message exactly once across both placements", () => {
    renderOffline();

    expect(screen.getByText("You are offline")).toBeInTheDocument();
    expect(
      screen.getByText("Changes will sync when back online"),
    ).toBeInTheDocument();
  });
});

function source(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("offline layout wiring", () => {
  it("defines the shared layout tokens in globals.css", () => {
    const css = source("app/globals.css");

    expect(css).toContain(
      "--mobile-header-height: calc(4rem + env(safe-area-inset-top, 0px));",
    );
    expect(css).toContain("--offline-banner-height: 2.25rem;");
    expect(css).toContain("--mobile-nav-content-height: 3.25rem;");
    expect(css).toContain("--mobile-nav-item-pad: 0.375rem;");
    expect(css).toContain(
      "--mobile-safe-bottom: max(env(safe-area-inset-bottom, 0px) - 6px, 0px);",
    );
    // Lightning CSS silently drops a math function that subtracts one var()
    // from another, and every declaration after it in the rule.
    expect(css).not.toMatch(/(min|max|clamp)\([^)]*var\([^)]*\)\s*-\s*var\(/);
  });

  it("derives every bottom-anchored offset from --mobile-nav-height", () => {
    const consumers = [
      "src/components/tasks/AddTaskFab.tsx",
      "src/components/habits/AddHabitFab.tsx",
      "src/components/calendar/AddEventFab.tsx",
      "src/components/ui/toaster.tsx",
      "src/components/telemetry/TelemetryConsentPrompt.tsx",
    ];

    for (const path of consumers) {
      const code = source(path);
      expect(code, path).toContain("var(--mobile-nav-height)");
      expect(code, path).not.toMatch(/bottom[^\n]*\b(66|72)px/);
    }
  });

  it("derives the scroll container's bottom spacers from --mobile-nav-height", () => {
    const shell = source("src/components/layout/AppShell.tsx");

    const spacers = shell.match(
      /className="h-\[[^"]*\] w-full flex-none md:hidden"/g,
    );
    expect(spacers).toHaveLength(2);
    for (const spacer of spacers ?? []) {
      expect(spacer).toContain("var(--mobile-nav-height)");
    }
    expect(shell).not.toMatch(/className="h-\d+ w-full flex-none md:hidden"/);
  });

  it("mounts the indicator inside SidebarInset rather than GlobalOverlays", () => {
    const shell = source("src/components/layout/AppShell.tsx");

    const insetOpen = shell.indexOf("<SidebarInset");
    const insetClose = shell.indexOf("</SidebarInset>");
    const mount = shell.indexOf("<OfflineIndicator />");

    expect(mount).toBeGreaterThan(insetOpen);
    expect(mount).toBeLessThan(insetClose);
  });

  it("pads the scroll container by header height plus banner height", () => {
    const shell = source("src/components/layout/AppShell.tsx");

    expect(shell).toContain('"pt-[var(--mobile-header-height)]"');
    expect(shell).toContain(
      "pt-[calc(var(--mobile-header-height)+var(--offline-banner-height))]",
    );
    expect(shell).toContain('"pt-[var(--offline-banner-height)]"');
    expect(shell).not.toContain("pt-[calc(4rem+env(safe-area-inset-top,0px))]");
  });

  it("lifts desktop toasts clear of the offline pill via the Toaster's own offset prop, not a per-toast margin", () => {
    const toaster = source("src/components/ui/toaster.tsx");

    // Sonner stacking math ignores per-toast margins; shifting requires the container offset prop.
    expect(toaster).toContain(
      "calc(1.25rem + var(--offline-pill-offset,0px) + var(--telemetry-prompt-offset,0px))",
    );
    expect(toaster).not.toContain("md:mb-5");
    expect(toaster).not.toContain("mb-[");
  });
});
