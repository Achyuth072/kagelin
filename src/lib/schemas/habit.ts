import { z } from "zod";

export const CreateHabitSchema = z.object({
  name: z.string().min(1, "Habit name is required").max(100),
  description: z.string().max(500).optional(),
  color: z
    .string()
    .regex(/^#[A-Fa-f0-9]{6}$/, "Invalid color format")
    .optional(),
  icon: z.string().max(50).optional(),
  start_date: z
    .union([z.date(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
    .optional(),
  habit_type: z.enum(["boolean", "measurable"]).optional(),
  frequency_count: z.number().int().positive().optional(),
  frequency_period: z.enum(["day", "week", "month"]).optional(),
  target_type: z.enum(["at_least", "at_most"]).optional(),
  target_value: z.number().optional(),
  unit: z.string().max(50).optional(),
});

export type CreateHabitInput = z.infer<typeof CreateHabitSchema>;
