import { describe, it, expect, vi } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import {
  escapeCsvField,
  formatCsvRow,
  toCsvColor,
  sanitizeHabitDirName,
  formatHabitDirName,
  formatRepetitionValue,
  generateHabitsCsv,
  generateHabitCheckmarksCsv,
  generateHabitScoresCsv,
  generateCheckmarksMatrixCsv,
  generateScoresMatrixCsv,
  buildUhabitsCsvArchive,
  exportToUhabitsZip,
  generateUhabitsZipFilename,
} from "@/lib/export/uhabitsExportCsv";
import type { Habit, HabitEntry } from "@/lib/types/habit";
import { mockStore } from "@/lib/mock/mock-store";

describe("uhabitsExportCsv - pure helpers", () => {
  describe("escapeCsvField", () => {
    it("returns plain strings unchanged when no special characters are present", () => {
      expect(escapeCsvField("Meditate")).toBe("Meditate");
      expect(escapeCsvField("001")).toBe("001");
      expect(escapeCsvField("YES_MANUAL")).toBe("YES_MANUAL");
    });

    it("returns empty string for null, undefined, or empty string", () => {
      expect(escapeCsvField(null)).toBe("");
      expect(escapeCsvField(undefined)).toBe("");
      expect(escapeCsvField("")).toBe("");
    });

    it("converts numbers and booleans to strings", () => {
      expect(escapeCsvField(42)).toBe("42");
      expect(escapeCsvField(0)).toBe("0");
      expect(escapeCsvField(true)).toBe("true");
      expect(escapeCsvField(false)).toBe("false");
    });

    it("wraps strings containing commas in quotes", () => {
      expect(escapeCsvField("Forgot to do it, really")).toBe(
        '"Forgot to do it, really"',
      );
    });

    it("escapes internal quotes by doubling them and wrapping in quotes", () => {
      expect(escapeCsvField('"Vacation"')).toBe('"""Vacation"""');
      expect(escapeCsvField('Say "hello"')).toBe('"Say ""hello"""');
    });

    it("wraps strings containing newlines in quotes", () => {
      expect(escapeCsvField("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
    });
  });

  describe("formatCsvRow", () => {
    it("joins escaped fields with commas without trailing comma", () => {
      expect(formatCsvRow(["001", "Meditate", "YES_NO"])).toBe(
        "001,Meditate,YES_NO",
      );
      expect(formatCsvRow(["002", "Wake up early", 'Sick, "flu"'])).toBe(
        '002,Wake up early,"Sick, ""flu"""',
      );
    });
  });

  describe("toCsvColor", () => {
    it("maps palette indices 0-19 to official Loop CSV hex colors", () => {
      expect(toCsvColor(0)).toBe("#D32F2F");
      expect(toCsvColor(2)).toBe("#F57C00");
      expect(toCsvColor(3)).toBe("#FF8F00");
      expect(toCsvColor(8)).toBe("#00897B");
      expect(toCsvColor(11)).toBe("#1976D2");
      expect(toCsvColor(19)).toBe("#aaaaaa");
    });

    it("handles palette index 20 (brown fallback)", () => {
      expect(toCsvColor(20)).toBe("#4e342e");
    });
  });

  describe("sanitizeHabitDirName", () => {
    it("preserves alphanumeric characters, spaces, dots, dashes, and underscores", () => {
      expect(sanitizeHabitDirName("Wake up early")).toBe("Wake up early");
      expect(sanitizeHabitDirName("Habit_1.2-test")).toBe("Habit_1.2-test");
    });

    it("removes illegal filesystem and non-ascii characters", () => {
      expect(sanitizeHabitDirName("Read a book / study?")).toBe(
        "Read a book  study",
      );
      expect(sanitizeHabitDirName("Haircut ✂️")).toBe("Haircut ");
    });

    it("caps filename length at 100 characters", () => {
      const longName = "A".repeat(120);
      expect(sanitizeHabitDirName(longName)).toBe("A".repeat(100));
    });
  });

  describe("formatHabitDirName", () => {
    it("formats habit index and name as 001 Name/ with trailing slash", () => {
      expect(formatHabitDirName(0, "Meditate")).toBe("001 Meditate/");
      expect(formatHabitDirName(1, "Wake up early")).toBe("002 Wake up early/");
      expect(formatHabitDirName(9, "Exercise")).toBe("010 Exercise/");
    });

    it("handles habits with empty or stripped names", () => {
      expect(formatHabitDirName(0, "")).toBe("001/");
      expect(formatHabitDirName(2, "???")).toBe("003/");
    });
  });

  describe("formatRepetitionValue", () => {
    it("maps integer enum values to Loop entry formatted string", () => {
      expect(formatRepetitionValue(2)).toBe("YES_MANUAL");
      expect(formatRepetitionValue(1)).toBe("YES_AUTO");
      expect(formatRepetitionValue(0)).toBe("NO");
      expect(formatRepetitionValue(3)).toBe("SKIP");
      expect(formatRepetitionValue(-1)).toBe("UNKNOWN");
    });

    it("formats numerical habit repetition integers directly", () => {
      expect(formatRepetitionValue(1000)).toBe("1000");
      expect(formatRepetitionValue(8000)).toBe("8000");
      expect(formatRepetitionValue(1500)).toBe("1500");
    });
  });
});

describe("uhabitsExportCsv - CSV generators", () => {
  const mockHabit1: Habit = {
    id: "h1",
    user_id: "u1",
    name: "Meditate",
    description: null,
    color: "#ffc107",
    icon: "Brain",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    archived_at: null,
    start_date: "2024-01-01",
    sort_order: 0,
    habit_type: "boolean",
    frequency_count: 1,
    frequency_period: "day",
    question: "Did you meditate this morning?",
    target_value: null,
    target_type: null,
    unit: null,
  };

  const mockHabit2: Habit = {
    id: "h2",
    user_id: "u1",
    name: "Wake up early",
    description: "Morning routine",
    color: "#00bcd4",
    icon: "Sun",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    archived_at: null,
    start_date: "2024-01-01",
    sort_order: 1,
    habit_type: "boolean",
    frequency_count: 2,
    frequency_period: "week",
    question: "Did you wake up before 6am?",
    target_value: null,
    target_type: null,
    unit: null,
  };

  const mockHabit3: Habit = {
    id: "h3",
    user_id: "u1",
    name: "Read a book",
    description: "Read 10 pages daily",
    color: "#e91e63",
    icon: "Book",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    archived_at: "2024-06-01T00:00:00Z",
    start_date: "2024-01-01",
    sort_order: 2,
    habit_type: "measurable",
    frequency_count: 1,
    frequency_period: "day",
    question: "How many pages did you read?",
    target_value: 10,
    target_type: "at_least",
    unit: "pages",
  };

  const mockEntries: HabitEntry[] = [
    {
      id: "e1",
      habit_id: "h2",
      date: "2024-01-03",
      value: 1,
      notes: null,
      created_at: "2024-01-03T00:00:00Z",
    },
    {
      id: "e2",
      habit_id: "h2",
      date: "2024-01-02",
      value: 0,
      notes: "Sick",
      created_at: "2024-01-02T00:00:00Z",
    },
    {
      id: "e3",
      habit_id: "h2",
      date: "2024-01-01",
      value: -2,
      notes: "Vacation",
      created_at: "2024-01-01T00:00:00Z",
    },
    {
      id: "e4",
      habit_id: "h3",
      date: "2024-01-03",
      value: 10,
      notes: null,
      created_at: "2024-01-03T00:00:00Z",
    },
    {
      id: "e5",
      habit_id: "h3",
      date: "2024-01-02",
      value: 5.5,
      notes: "Halfway",
      created_at: "2024-01-02T00:00:00Z",
    },
  ];

  describe("generateHabitsCsv", () => {
    it("generates exact Habits.csv with header and expected columns", () => {
      const csv = generateHabitsCsv([mockHabit1, mockHabit2, mockHabit3]);
      const lines = csv.trim().split("\n");

      expect(lines[0]).toBe(
        "Position,Name,Type,Question,Description,FrequencyNumerator,FrequencyDenominator,Color,Unit,Target Type,Target Value,Archived?",
      );
      expect(lines).toHaveLength(4);

      expect(lines[1]).toBe(
        "001,Meditate,YES_NO,Did you meditate this morning?,,1,1,#FF8F00,,,,false",
      );
      expect(lines[2]).toBe(
        "002,Wake up early,YES_NO,Did you wake up before 6am?,Morning routine,2,7,#00897B,,,,false",
      );
      expect(lines[3]).toBe(
        "003,Read a book,NUMERICAL,How many pages did you read?,Read 10 pages daily,1,1,#8E24AA,pages,AT_LEAST,10,true",
      );
    });

    it("preserves raw provenance frequencies and properties if available", () => {
      const rawSources = [
        {
          habits: [
            {
              uuid: "test-uuid-1",
              freq_num: 3,
              freq_den: 14,
              color: 2,
            },
          ],
        },
      ];
      const habitWithProvenance: Habit = {
        ...mockHabit1,
        source_uuid: "test-uuid-1",
      };

      const csv = generateHabitsCsv([habitWithProvenance], rawSources);
      const lines = csv.trim().split("\n");

      expect(lines[1]).toBe(
        "001,Meditate,YES_NO,Did you meditate this morning?,,3,14,#F57C00,,,,false",
      );
    });
  });

  describe("generateHabitCheckmarksCsv", () => {
    it("outputs only the header for a habit with no entries", () => {
      const csv = generateHabitCheckmarksCsv(mockHabit1, mockEntries, {
        today: "2024-01-03",
      });
      expect(csv).toBe("Date,Value,Notes\n");
    });

    it("outputs known entries in descending chronological order with notes", () => {
      const csv = generateHabitCheckmarksCsv(mockHabit2, mockEntries, {
        today: "2024-01-03",
      });
      const lines = csv.trim().split("\n");
      expect(lines[0]).toBe("Date,Value,Notes");
      expect(lines).toContain("2024-01-03,YES_MANUAL,");
      expect(lines).toContain("2024-01-02,NO,Sick");
      expect(lines).toContain("2024-01-01,SKIP,Vacation");
      expect(lines[1].startsWith("2024-01-03")).toBe(true);
    });

    it("formats measurable habit values multiplied by 1000", () => {
      const csv = generateHabitCheckmarksCsv(mockHabit3, mockEntries, {
        today: "2024-01-03",
      });
      const lines = csv.trim().split("\n");
      expect(lines[0]).toBe("Date,Value,Notes");
      expect(lines).toContain("2024-01-03,10000,");
      expect(lines).toContain("2024-01-02,5500,Halfway");
    });
  });

  describe("generateHabitScoresCsv", () => {
    it("outputs a single row for today with 0.0000 for a habit with no entries", () => {
      const csv = generateHabitScoresCsv(mockHabit1, mockEntries, {
        today: "2024-01-03",
      });
      const lines = csv.trim().split("\n");
      expect(lines[0]).toBe("Date,Score");
      expect(lines[1]).toBe("2024-01-03,0.0000");
    });

    it("outputs scores to 4 decimal places from today down to oldest entry date", () => {
      const csv = generateHabitScoresCsv(mockHabit2, mockEntries, {
        today: "2024-01-03",
      });
      const lines = csv.trim().split("\n");
      expect(lines[0]).toBe("Date,Score");
      expect(lines.length).toBeGreaterThanOrEqual(4);
      expect(lines[1].startsWith("2024-01-03,")).toBe(true);
      expect(lines[1]).toMatch(/2024-01-03,\d+\.\d{4}/);
    });
  });

  describe("generateCheckmarksMatrixCsv", () => {
    it("generates root Checkmarks.csv matrix with trailing comma on each row", () => {
      const csv = generateCheckmarksMatrixCsv(
        [mockHabit1, mockHabit2, mockHabit3],
        mockEntries,
        { today: "2024-01-03" },
      );
      const lines = csv.trim().split("\n");

      expect(lines[0]).toBe("Date,Meditate,Wake up early,Read a book,");
      expect(lines[1].endsWith(",")).toBe(true);
      expect(lines[1].startsWith("2024-01-03,")).toBe(true);
      expect(lines[1]).toBe("2024-01-03,UNKNOWN,YES_MANUAL,10000,");
    });
  });

  describe("generateScoresMatrixCsv", () => {
    it("generates root Scores.csv matrix with trailing comma on each row", () => {
      const csv = generateScoresMatrixCsv(
        [mockHabit1, mockHabit2, mockHabit3],
        mockEntries,
        { today: "2024-01-03" },
      );
      const lines = csv.trim().split("\n");

      expect(lines[0]).toBe("Date,Meditate,Wake up early,Read a book,");
      expect(lines[1].endsWith(",")).toBe(true);
      expect(lines[1].startsWith("2024-01-03,")).toBe(true);
      expect(lines[1]).toMatch(/2024-01-03,0\.0000,\d+\.\d{4},\d+\.\d{4},/);
    });
  });
});

describe("uhabitsExportCsv - ZIP Archive Assembly", () => {
  const mockHabit1: Habit = {
    id: "h1",
    user_id: "u1",
    name: "Meditate",
    description: null,
    color: "#ffc107",
    icon: "Brain",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    archived_at: null,
    start_date: "2024-01-01",
    sort_order: 0,
    habit_type: "boolean",
    frequency_count: 1,
    frequency_period: "day",
    question: "Did you meditate this morning?",
    target_value: null,
    target_type: null,
    unit: null,
  };

  const mockHabit2: Habit = {
    id: "h2",
    user_id: "u1",
    name: "Wake up early",
    description: "Morning routine",
    color: "#00bcd4",
    icon: "Sun",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    archived_at: null,
    start_date: "2024-01-01",
    sort_order: 1,
    habit_type: "boolean",
    frequency_count: 2,
    frequency_period: "week",
    question: "Did you wake up before 6am?",
    target_value: null,
    target_type: null,
    unit: null,
  };

  const mockEntries: HabitEntry[] = [
    {
      id: "e1",
      habit_id: "h2",
      date: "2024-01-03",
      value: 1,
      notes: null,
      created_at: "2024-01-03T00:00:00Z",
    },
    {
      id: "e2",
      habit_id: "h2",
      date: "2024-01-02",
      value: 0,
      notes: "Sick",
      created_at: "2024-01-02T00:00:00Z",
    },
  ];

  describe("generateUhabitsZipFilename", () => {
    it("formats the filename as Loop Habits CSV yyyy-MM-dd.zip", () => {
      expect(generateUhabitsZipFilename("2024-01-03")).toBe(
        "Loop Habits CSV 2024-01-03.zip",
      );
      expect(generateUhabitsZipFilename(new Date("2024-01-03T12:00:00Z"))).toBe(
        "Loop Habits CSV 2024-01-03.zip",
      );
    });
  });

  describe("buildUhabitsCsvArchive", () => {
    it("builds the exact file dictionary matching Loop's HabitsCSVExporter", () => {
      const archive = buildUhabitsCsvArchive(
        { habits: [mockHabit1, mockHabit2], entries: mockEntries },
        { today: "2024-01-03" },
      );

      const filePaths = Object.keys(archive).sort();
      expect(filePaths).toEqual([
        "001 Meditate/Checkmarks.csv",
        "001 Meditate/Scores.csv",
        "002 Wake up early/Checkmarks.csv",
        "002 Wake up early/Scores.csv",
        "Checkmarks.csv",
        "Habits.csv",
        "Scores.csv",
      ]);
    });
  });

  describe("exportToUhabitsZip", () => {
    it("packs a valid ZIP archive readable by fflate.unzipSync with expected files", async () => {
      const zipBytes = await exportToUhabitsZip({
        habits: [mockHabit1, mockHabit2],
        entries: mockEntries,
        today: "2024-01-03",
      });

      expect(zipBytes).toBeInstanceOf(Uint8Array);
      expect(zipBytes.length).toBeGreaterThan(0);

      const unzipped = unzipSync(zipBytes);
      const fileNames = Object.keys(unzipped).sort();

      expect(fileNames).toEqual([
        "001 Meditate/Checkmarks.csv",
        "001 Meditate/Scores.csv",
        "002 Wake up early/Checkmarks.csv",
        "002 Wake up early/Scores.csv",
        "Checkmarks.csv",
        "Habits.csv",
        "Scores.csv",
      ]);

      const habitsCsv = strFromU8(unzipped["Habits.csv"]);
      expect(habitsCsv).toContain("001,Meditate,YES_NO");
      expect(habitsCsv).toContain("002,Wake up early,YES_NO");

      const checkmarksCsv = strFromU8(unzipped["Checkmarks.csv"]);
      expect(checkmarksCsv).toContain("Date,Meditate,Wake up early,");
      expect(checkmarksCsv).toContain("2024-01-03,UNKNOWN,YES_MANUAL,");

      const scoresCsv = strFromU8(unzipped["Scores.csv"]);
      expect(scoresCsv).toContain("Date,Meditate,Wake up early,");

      const meditateChecks = strFromU8(unzipped["001 Meditate/Checkmarks.csv"]);
      expect(meditateChecks).toBe("Date,Value,Notes\n");

      const meditateScores = strFromU8(unzipped["001 Meditate/Scores.csv"]);
      expect(meditateScores).toBe("Date,Score\n2024-01-03,0.0000\n");
    });

    it("reads through normal wrapped client so encrypted fields are already decrypted", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "habits") {
            return {
              select: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              range: vi.fn().mockResolvedValue({
                data: [
                  {
                    ...mockHabit1,
                    name: "Decrypted Meditation",
                    description: "Decrypted description",
                    question: "Did you meditate peacefully?",
                  },
                ],
                error: null,
              }),
            };
          }
          if (table === "habit_entries") {
            return {
              select: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              range: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "e-dec",
                    habit_id: "h1",
                    date: "2024-01-03",
                    value: 1,
                    notes: "Decrypted note",
                    created_at: "2024-01-03T00:00:00Z",
                  },
                ],
                error: null,
              }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          };
        }),
      };

      const zipBytes = await exportToUhabitsZip({
        supabase:
          mockSupabase as unknown as import("@supabase/supabase-js").SupabaseClient,
        isGuest: false,
        today: "2024-01-03",
      });

      const unzipped = unzipSync(zipBytes);
      const habitsCsv = strFromU8(unzipped["Habits.csv"]);
      expect(habitsCsv).toContain("Decrypted Meditation");
      expect(habitsCsv).toContain("Decrypted description");
      expect(habitsCsv).toContain("Did you meditate peacefully?");

      const checksCsv = strFromU8(
        unzipped["001 Decrypted Meditation/Checkmarks.csv"],
      );
      expect(checksCsv).toContain("2024-01-03,YES_MANUAL,Decrypted note");
    });

    it("reads from mockStore when in guest mode", async () => {
      vi.spyOn(mockStore, "getHabits").mockReturnValueOnce([mockHabit1]);
      vi.spyOn(mockStore, "getHabitEntries").mockReturnValueOnce([
        {
          id: "g-e1",
          habit_id: "h1",
          date: "2024-01-03",
          value: 1,
          notes: "Guest note",
          created_at: "2024-01-03T00:00:00Z",
        },
      ]);

      const zipBytes = await exportToUhabitsZip({
        isGuest: true,
        today: "2024-01-03",
      });

      const unzipped = unzipSync(zipBytes);
      const habitsCsv = strFromU8(unzipped["Habits.csv"]);
      expect(habitsCsv).toContain("001,Meditate,YES_NO");

      const checksCsv = strFromU8(unzipped["001 Meditate/Checkmarks.csv"]);
      expect(checksCsv).toContain("2024-01-03,YES_MANUAL,Guest note");
    });
  });

  describe("real Loop Habits backup database export verification", () => {
    it("imports from Loop Habits Backup 2026-09-03 103056.db and exports to a valid Loop ZIP archive", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const { parseUhabitsFile } = await import("@/lib/import/uhabits");

      const dbPath = path.resolve(
        process.cwd(),
        ".scratch/import/Loop Habits Backup 2026-09-03 103056.db",
      );
      expect(fs.existsSync(dbPath)).toBe(true);

      const originalBuffer = fs.readFileSync(dbPath);
      const { habits, entries, source } = await parseUhabitsFile(
        originalBuffer,
        "public/sql-wasm.wasm",
      );

      const zipBytes = await exportToUhabitsZip({
        habits,
        entries,
        rawSources: [source],
        today: "2026-09-03",
      });

      expect(zipBytes).toBeInstanceOf(Uint8Array);
      expect(zipBytes.length).toBeGreaterThan(0);

      const unzipped = unzipSync(zipBytes);
      const fileNames = Object.keys(unzipped);

      expect(fileNames).toContain("Habits.csv");
      expect(fileNames).toContain("Checkmarks.csv");
      expect(fileNames).toContain("Scores.csv");

      expect(fileNames).toContain("001 EARLY TO RISE/Checkmarks.csv");
      expect(fileNames).toContain("001 EARLY TO RISE/Scores.csv");
      expect(fileNames).toContain("002 SHAMPOO/Checkmarks.csv");
      expect(fileNames).toContain("002 SHAMPOO/Scores.csv");
      expect(fileNames).toContain("003 WORKOUT/Checkmarks.csv");
      expect(fileNames).toContain("003 WORKOUT/Scores.csv");
      expect(fileNames).toContain("004 READ A BOOK/Checkmarks.csv");
      expect(fileNames).toContain("004 READ A BOOK/Scores.csv");
      expect(fileNames).toContain("012 WASH TOWEL/Checkmarks.csv");
      expect(fileNames).toContain("012 WASH TOWEL/Scores.csv");

      const habitsCsv = strFromU8(unzipped["Habits.csv"]);
      const habitsLines = habitsCsv.trim().split("\n");
      expect(habitsLines).toHaveLength(13);
      expect(habitsCsv).toContain("001,EARLY TO RISE,YES_NO");
      expect(habitsCsv).toContain("004,READ A BOOK,NUMERICAL");

      const checkmarksCsv = strFromU8(unzipped["Checkmarks.csv"]);
      const checkmarksLines = checkmarksCsv.trim().split("\n");
      const checkmarksHeaderCols = checkmarksLines[0].split(",");
      expect(checkmarksHeaderCols[0]).toBe("Date");
      expect(checkmarksHeaderCols).toContain("EARLY TO RISE");
      expect(checkmarksHeaderCols).toContain("READ A BOOK");
      expect(checkmarksHeaderCols).toContain("WASH TOWEL");

      const scoresCsv = strFromU8(unzipped["Scores.csv"]);
      const scoresLines = scoresCsv.trim().split("\n");
      const scoresHeaderCols = scoresLines[0].split(",");
      expect(scoresHeaderCols[0]).toBe("Date");
      expect(scoresHeaderCols).toContain("EARLY TO RISE");
      expect(scoresHeaderCols).toContain("READ A BOOK");

      const readBookChecks = strFromU8(
        unzipped["004 READ A BOOK/Checkmarks.csv"],
      );
      expect(readBookChecks).toContain("1000");
      expect(readBookChecks).toContain("8000");

      const workoutChecks = strFromU8(unzipped["003 WORKOUT/Checkmarks.csv"]);
      expect(workoutChecks).toContain("SKIP");
      expect(workoutChecks).toContain("YES_MANUAL");
    });
  });
});
