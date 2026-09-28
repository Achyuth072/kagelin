import type React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HabitSheet } from "@/components/habits/HabitSheet";
import {
  useCreateHabit,
  useUpdateHabit,
  useDeleteHabit,
  useArchiveHabit,
} from "@/lib/hooks/useHabitMutations";
import type { Habit } from "@/lib/types/habit";

vi.mock("@/lib/hooks/useHabitMutations", () => ({
  useCreateHabit: vi.fn(),
  useUpdateHabit: vi.fn(),
  useDeleteHabit: vi.fn(),
  useArchiveHabit: vi.fn(),
}));

vi.mock("@/components/ui/responsive-dialog", () => ({
  ResponsiveDialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open: boolean;
  }) => (open ? <div>{children}</div> : null),
  ResponsiveDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ResponsiveDialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ResponsiveDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  ResponsiveDialogDescription: ({
    children,
  }: {
    children: React.ReactNode;
  }) => <p>{children}</p>,
}));

const mockHapticTrigger = vi.fn();
vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({
    trigger: mockHapticTrigger,
    isPhone: false,
  }),
}));

vi.mock("../tasks/shared/TaskDatePicker", () => ({
  TaskDatePicker: () => <div data-testid="date-picker">Date Picker</div>,
}));

describe("HabitSheet", () => {
  const mockCreateMutate = vi.fn();
  const mockUpdateMutate = vi.fn();
  const mockDeleteMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useCreateHabit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockCreateMutate,
      isPending: false,
    });
    (useUpdateHabit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockUpdateMutate,
      isPending: false,
    });
    (useArchiveHabit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    (useDeleteHabit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockDeleteMutate,
      isPending: false,
    });
  });

  it('renders "New Habit" header in creation mode', () => {
    render(<HabitSheet open={true} onClose={() => {}} />);
    expect(screen.getAllByText("New Habit")[0]).toBeInTheDocument();
  });

  it('renders "Edit Habit" header in edit mode', async () => {
    const mockHabit = {
      id: "1",
      name: "Exercise",
      description: "Daily workout",
      color: "#4B6CB7",
      icon: "Flame",
    } as unknown as Habit;

    await act(async () => {
      render(
        <HabitSheet open={true} onClose={() => {}} initialHabit={mockHabit} />,
      );
    });

    expect(screen.getAllByText("Edit Habit")[0]).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Habit name")).toHaveValue("Exercise");
  });

  it("calls createHabit mutation when submitting a new habit", async () => {
    render(<HabitSheet open={true} onClose={() => {}} />);

    const nameInput = screen.getByPlaceholderText("Habit name");
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "New Habit Name" } });
    });

    const submitButton = screen.getByLabelText(/start habit/i);
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(mockCreateMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New Habit Name",
        }),
      );
    });
  });

  it("calls deleteHabit mutation after confirmation", async () => {
    const mockHabit = {
      id: "1",
      name: "To Delete",
      color: "#4B6CB7",
    } as unknown as Habit;

    render(
      <HabitSheet open={true} onClose={() => {}} initialHabit={mockHabit} />,
    );

    const deleteBtn = screen.getByLabelText(/delete habit/i);
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    expect(
      screen.getByText(/Are you sure you want to delete "To Delete"/i),
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: /delete/i });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(mockDeleteMutate).toHaveBeenCalledWith("1");
  });

  it("disables submit button if name is empty", () => {
    render(<HabitSheet open={true} onClose={() => {}} />);
    const submitButton = screen.getByLabelText(/start habit/i);
    expect(submitButton).toBeDisabled();
  });
});
