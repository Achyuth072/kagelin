import { z } from "zod";

const PrioritySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

// DnD writes plain dates ("yyyy-MM-dd") while recurrence and some APIs write
// full ISO datetimes. Accept either format so validation doesn't reject
// DnD-moved tasks when they are later opened in a form.
const DateOrDateTimeString = z.union([
  z.string().date(),
  z.string().datetime(),
  z.string().datetime({ offset: true }),
]);

export const CreateTaskSchema = z.object({
  content: z.string().min(1, "Task content is required").max(500),
  description: z.string().max(5000).optional(),
  priority: PrioritySchema.optional(),
  due_date: z.union([z.date(), DateOrDateTimeString]).nullable().optional(),
  do_date: z.union([z.date(), DateOrDateTimeString]).nullable().optional(),
  is_evening: z.boolean().default(false).optional(),
  project_id: z.string().nullable().optional(),
  parent_id: z.string().optional(),
  recurrence: z
    .object({
      freq: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
      interval: z.number(),
      days: z.array(z.number()).optional(),
      mode: z.enum(["strict", "flexible"]).optional(),
    })
    .nullable()
    .optional(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
