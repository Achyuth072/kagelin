import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/components/AuthProvider";
import { DemoBar } from "@/components/DemoBar";
import { mockStore } from "@/lib/mock/mock-store";
import { useUiStore } from "@/lib/store/uiStore";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  })),
}));

vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

// Force desktop AlertDialog branch of the confirm dialog.
vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: vi.fn(() => true),
}));

function renderDemoBar() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DemoBar />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("DemoBar", () => {
  beforeEach(() => {
    localStorage.clear();
    mockStore.clearData();
    useUiStore.getState().setShortcutsHelpOpen(false);
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
    });
  });

  it("renders nothing outside guest mode", async () => {
    mockStore.reset();
    renderDemoBar();

    await waitFor(() =>
      expect(screen.queryByText(/start fresh/i)).not.toBeInTheDocument(),
    );
  });

  it("renders nothing once the guest's store has no Demo item left", async () => {
    localStorage.setItem("kanso_guest_mode", "true");
    mockStore.clearData();
    renderDemoBar();

    await waitFor(() =>
      expect(screen.queryByText(/start fresh/i)).not.toBeInTheDocument(),
    );
  });

  it("shows a Start fresh action while the guest is in Demo mode", async () => {
    localStorage.setItem("kanso_guest_mode", "true");
    mockStore.reset();
    renderDemoBar();

    expect(
      await screen.findByRole("button", { name: /start fresh/i }),
    ).toBeInTheDocument();
  });

  it("offers the shortcuts list as the next step", async () => {
    localStorage.setItem("kanso_guest_mode", "true");
    mockStore.reset();
    renderDemoBar();

    fireEvent.click(await screen.findByRole("button", { name: /shortcuts/i }));

    expect(useUiStore.getState().isShortcutsHelpOpen).toBe(true);
  });

  it("is a pill centred in the content column on desktop, like OfflineIndicator", async () => {
    localStorage.setItem("kanso_guest_mode", "true");
    mockStore.reset();
    renderDemoBar();

    const wrapper = await screen.findByTestId("demo-bar");
    const card = wrapper.firstElementChild as HTMLElement;

    expect(wrapper.className).toContain("md:absolute");
    expect(wrapper.className).toContain("md:top-auto");
    expect(wrapper.className).toContain("md:bottom-6");
    expect(card.className).toContain("md:w-auto");
    expect(card.className).toContain("md:rounded-lg");
  });

  it("hides while offline, even in Demo mode", async () => {
    localStorage.setItem("kanso_guest_mode", "true");
    mockStore.reset();
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });
    renderDemoBar();

    await waitFor(() =>
      expect(screen.queryByText(/start fresh/i)).not.toBeInTheDocument(),
    );
  });

  it("routes Start fresh through the destructive confirm dialog, and confirming clears the guest store", async () => {
    localStorage.setItem("kanso_guest_mode", "true");
    mockStore.reset();
    renderDemoBar();

    fireEvent.click(
      await screen.findByRole("button", { name: /start fresh/i }),
    );

    const dialogConfirm = await screen.findByRole("button", {
      name: /delete account data/i,
    });
    expect(dialogConfirm).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/type 'delete'/i), {
      target: { value: "delete" },
    });
    fireEvent.click(dialogConfirm);

    await waitFor(() => expect(mockStore.getTasks()).toEqual([]));
    await waitFor(() =>
      expect(screen.queryByText(/start fresh/i)).not.toBeInTheDocument(),
    );
  });
});
