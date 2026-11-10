import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TaskSheet from "@/components/tasks/TaskSheet";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
} from "@/components/ui/responsive-dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/hooks/useTaskMutations", () => ({
  useCreateTask: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useUpdateTask: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteTask: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useToggleTask: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useReorderTasks: vi.fn(() => ({ mutate: vi.fn() })),
}));

vi.mock("@/lib/hooks/useTasks", () => ({
  useInboxProject: vi.fn(() => ({ data: { id: "inbox-1" } })),
  useTaskSeries: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock("@/lib/hooks/useProjects", () => ({
  useProjects: vi.fn(() => ({ data: [] })),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(() => ({ isGuestMode: true, user: { id: "user-123" } })),
}));

vi.mock("@/lib/hooks/useSubtasks", () => ({
  useSubtasks: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn(), isPhone: true }),
}));

let mockMediaQueries: Record<string, boolean> = {
  "(max-width: 640px)": true,
  "(pointer: fine)": false,
  "(pointer: coarse)": true,
};

vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: (query: string) => mockMediaQueries[query] ?? false,
}));

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: mockMediaQueries[query] ?? false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

const renderWithQuery = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
};

describe("Mobile drawer keyboard prevention", () => {
  beforeEach(() => {
    mockMediaQueries = {
      "(max-width: 640px)": true,
      "(pointer: fine)": false,
      "(pointer: coarse)": true,
    };
  });

  it("does not autofocus title input when TaskSheet drawer opens on mobile / touch devices", () => {
    renderWithQuery(<TaskSheet open={true} onClose={() => {}} />);

    const input = screen.getByPlaceholderText("What needs to be done?");
    expect(document.activeElement).not.toBe(input);
    expect(input).not.toHaveFocus();
    expect(input.getAttribute("autofocus")).toBeNull();
  });

  it("allows user to focus title input when explicitly tapping/clicking on mobile", () => {
    renderWithQuery(<TaskSheet open={true} onClose={() => {}} />);

    const input = screen.getByPlaceholderText("What needs to be done?");
    expect(document.activeElement).not.toBe(input);

    input.focus();
    expect(document.activeElement).toBe(input);
    expect(input).toHaveFocus();
  });

  it("autofocuses title input when TaskSheet opens on desktop with fine pointer", () => {
    mockMediaQueries = {
      "(max-width: 640px)": false,
      "(pointer: fine)": true,
      "(pointer: coarse)": false,
    };

    renderWithQuery(<TaskSheet open={true} onClose={() => {}} />);

    const input = screen.getByPlaceholderText("What needs to be done?");
    expect(document.activeElement).toBe(input);
    expect(input).toHaveFocus();
  });
});

describe("Generic drawer auto-focus behavior", () => {
  beforeEach(() => {
    mockMediaQueries = {
      "(max-width: 640px)": true,
      "(pointer: fine)": false,
      "(pointer: coarse)": true,
    };
  });

  it("prevents auto-focusing child text inputs when Drawer opens on mobile", () => {
    render(
      <Drawer open={true}>
        <DrawerContent>
          <div>
            <input data-testid="drawer-test-input" placeholder="Type here" />
          </div>
        </DrawerContent>
      </Drawer>,
    );

    const testInput = screen.getByTestId("drawer-test-input");
    expect(document.activeElement).not.toBe(testInput);
    expect(testInput).not.toHaveFocus();
  });

  it("allows user to focus child text input when explicitly tapping on mobile", () => {
    render(
      <Drawer open={true}>
        <DrawerContent>
          <div>
            <input data-testid="drawer-manual-input" placeholder="Type here" />
          </div>
        </DrawerContent>
      </Drawer>,
    );

    const testInput = screen.getByTestId("drawer-manual-input");
    expect(document.activeElement).not.toBe(testInput);

    testInput.focus();
    expect(document.activeElement).toBe(testInput);
    expect(testInput).toHaveFocus();
  });

  it("blurs child text input on mount if autoFocus is present inside Drawer on mobile", async () => {
    render(
      <Drawer open={true}>
        <DrawerContent>
          <div>
            <input
              data-testid="drawer-autofocus-input"
              autoFocus
              placeholder="Auto-focused"
            />
          </div>
        </DrawerContent>
      </Drawer>,
    );

    const autoFocusInput = screen.getByTestId("drawer-autofocus-input");
    await waitFor(() => {
      expect(document.activeElement).not.toBe(autoFocusInput);
      expect(autoFocusInput).not.toHaveFocus();
    });
  });

  it("retains focus on autoFocus child text input inside Drawer on desktop", () => {
    mockMediaQueries = {
      "(max-width: 640px)": false,
      "(pointer: fine)": true,
      "(pointer: coarse)": false,
    };

    render(
      <Drawer open={true}>
        <DrawerContent>
          <div>
            <input
              data-testid="drawer-autofocus-desktop-input"
              autoFocus
              placeholder="Auto-focused on desktop"
            />
          </div>
        </DrawerContent>
      </Drawer>,
    );

    const desktopInput = screen.getByTestId("drawer-autofocus-desktop-input");
    expect(document.activeElement).toBe(desktopInput);
    expect(desktopInput).toHaveFocus();
  });

  it("prevents auto-focusing child text inputs when ResponsiveDialog opens on mobile", () => {
    render(
      <ResponsiveDialog open={true} onOpenChange={() => {}}>
        <ResponsiveDialogContent>
          <div>
            <input
              data-testid="responsive-test-input"
              placeholder="Type here"
            />
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>,
    );

    const testInput = screen.getByTestId("responsive-test-input");
    expect(document.activeElement).not.toBe(testInput);
    expect(testInput).not.toHaveFocus();
  });

  it("prevents auto-focusing child text inputs when ResponsiveDialog opens on touch tablets", () => {
    mockMediaQueries = {
      "(max-width: 640px)": false,
      "(pointer: fine)": false,
      "(pointer: coarse)": true,
    };

    render(
      <ResponsiveDialog open={true} onOpenChange={() => {}}>
        <ResponsiveDialogContent>
          <div>
            <input data-testid="tablet-test-input" placeholder="Tablet input" />
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>,
    );

    const testInput = screen.getByTestId("tablet-test-input");
    expect(document.activeElement).not.toBe(testInput);
    expect(testInput).not.toHaveFocus();
  });
});
