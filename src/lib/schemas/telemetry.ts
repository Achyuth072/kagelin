import { z } from "zod";

export const AppOpenedEventSchema = z
  .object({
    name: z.literal("app_opened"),
    deviceId: z.string().uuid(),
    properties: z
      .object({
        display_mode: z.enum(["standalone", "browser"]),
        platform: z.enum(["ios", "android", "desktop"]),
      })
      .strict(),
  })
  .strict();

export const PwaInstalledEventSchema = z
  .object({
    name: z.literal("pwa_installed"),
    deviceId: z.string().uuid(),
    properties: z
      .object({
        platform: z.enum(["ios", "android", "desktop"]),
      })
      .strict(),
  })
  .strict();

export const TaskActionEventSchema = z
  .object({
    name: z.literal("task_action"),
    deviceId: z.string().uuid(),
    properties: z
      .object({
        action: z.enum(["created", "completed"]),
      })
      .strict(),
  })
  .strict();

export const HabitLoggedEventSchema = z
  .object({
    name: z.literal("habit_logged"),
    deviceId: z.string().uuid(),
    properties: z
      .object({
        streak_milestone: z.enum(["7", "30", "100"]).optional(),
      })
      .strict(),
  })
  .strict();

export const FocusSessionEventSchema = z
  .object({
    name: z.literal("focus_session"),
    deviceId: z.string().uuid(),
    properties: z
      .object({
        status: z.enum(["completed", "abandoned"]),
        duration_minutes: z.number().min(1).max(720),
      })
      .strict(),
  })
  .strict();

export const SignupCompletedEventSchema = z
  .object({
    name: z.literal("signup_completed"),
    deviceId: z.string().uuid(),
    properties: z.object({}).strict().optional(),
  })
  .strict();

export const TelemetryEventSchema = z.discriminatedUnion("name", [
  AppOpenedEventSchema,
  PwaInstalledEventSchema,
  TaskActionEventSchema,
  HabitLoggedEventSchema,
  FocusSessionEventSchema,
  SignupCompletedEventSchema,
]);

export const TelemetryBatchRequestSchema = z
  .object({
    events: z.array(TelemetryEventSchema).max(50),
  })
  .strict();

export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;
export type TelemetryBatchRequest = z.infer<typeof TelemetryBatchRequestSchema>;
