import { z } from "zod";

export const CreateProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(50),
  color: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color"),
  view_style: z.enum(["list", "board"]),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
