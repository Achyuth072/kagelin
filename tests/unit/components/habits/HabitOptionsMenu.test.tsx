import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HabitOptionsMenu } from "@/components/habits/HabitOptionsMenu";

const { mockImportUhabits, mockExportLoopDb, mockExportLoopZip, mockTrigger } =
  vi.hoisted(() => ({
    mockImportUhabits: vi.fn(),
    mockExportLoopDb: vi.fn(),
    mockExportLoopZip: vi.fn(),
    mockTrigger: vi.fn(),
  }));

let isImportingState = false;
let isExportingDbState = false;
let isExportingZipState = false;

vi.mock("@/lib/hooks/useUhabitsImport", () => ({
  useUhabitsImport: () => ({
    importUhabits: mockImportUhabits,
    isImporting: isImportingState,
  }),
}));

vi.mock("@/lib/hooks/useUhabitsExport", () => ({
  useUhabitsExport: () => ({
    exportLoopDb: mockExportLoopDb,
    exportLoopZip: mockExportLoopZip,
    isExportingDb: isExportingDbState,
    isExportingZip: isExportingZipState,
    isExporting: isExportingDbState || isExportingZipState,
  }),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: mockTrigger }),
}));

describe("HabitOptionsMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isImportingState = false;
    isExportingDbState = false;
    isExportingZipState = false;
  });

  it("renders menu trigger and shows options on open", async () => {
    render(<HabitOptionsMenu />);

    const triggerBtn = screen.getByRole("button", { name: /habit options/i });
    expect(triggerBtn).toBeInTheDocument();

    fireEvent.pointerDown(triggerBtn, { button: 0, ctrlKey: false });
    fireEvent.click(triggerBtn);

    expect(await screen.findByText("Habit Data")).toBeInTheDocument();
    expect(screen.getByText("Import Loop (.db)")).toBeInTheDocument();
    expect(screen.getByText("Export Loop (.db)")).toBeInTheDocument();
    expect(screen.getByText("Export Loop (CSV Zip)")).toBeInTheDocument();
  });

  it("triggers file input click when Import Loop (.db) is clicked", async () => {
    render(<HabitOptionsMenu />);

    const triggerBtn = screen.getByRole("button", { name: /habit options/i });
    fireEvent.pointerDown(triggerBtn, { button: 0, ctrlKey: false });
    fireEvent.click(triggerBtn);

    const importItem = await screen.findByText("Import Loop (.db)");
    const fileInput = screen.getByLabelText(/import/i) as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click");

    fireEvent.click(importItem);
    expect(clickSpy).toHaveBeenCalled();
  });

  it("triggers exportLoopDb when Export Loop (.db) is clicked", async () => {
    render(<HabitOptionsMenu />);

    const triggerBtn = screen.getByRole("button", { name: /habit options/i });
    fireEvent.pointerDown(triggerBtn, { button: 0, ctrlKey: false });
    fireEvent.click(triggerBtn);

    const exportDbItem = await screen.findByText("Export Loop (.db)");
    fireEvent.click(exportDbItem);

    expect(mockExportLoopDb).toHaveBeenCalled();
  });

  it("triggers exportLoopZip when Export Loop (CSV Zip) is clicked", async () => {
    render(<HabitOptionsMenu />);

    const triggerBtn = screen.getByRole("button", { name: /habit options/i });
    fireEvent.pointerDown(triggerBtn, { button: 0, ctrlKey: false });
    fireEvent.click(triggerBtn);

    const exportZipItem = await screen.findByText("Export Loop (CSV Zip)");
    fireEvent.click(exportZipItem);

    expect(mockExportLoopZip).toHaveBeenCalled();
  });

  it("disables trigger and items when an export is running", () => {
    isExportingDbState = true;
    render(<HabitOptionsMenu />);

    const triggerBtn = screen.getByRole("button", { name: /habit options/i });
    expect(triggerBtn).toBeDisabled();
  });
});
