import { describe, it, expect } from "vitest";
import {
  TelemetryEventSchema,
  TelemetryBatchRequestSchema,
} from "@/lib/schemas/telemetry";

describe("Telemetry Schemas", () => {
  const validDeviceId = "123e4567-e89b-12d3-a456-426614174000";

  describe("TelemetryEventSchema", () => {
    it("validates valid app_opened event", () => {
      const result = TelemetryEventSchema.safeParse({
        name: "app_opened",
        deviceId: validDeviceId,
        properties: {
          display_mode: "standalone",
          platform: "ios",
        },
      });

      expect(result.success).toBe(true);
    });

    it("validates valid pwa_installed event", () => {
      const result = TelemetryEventSchema.safeParse({
        name: "pwa_installed",
        deviceId: validDeviceId,
        properties: {
          platform: "android",
        },
      });

      expect(result.success).toBe(true);
    });

    it("validates valid task_action event", () => {
      const createdResult = TelemetryEventSchema.safeParse({
        name: "task_action",
        deviceId: validDeviceId,
        properties: {
          action: "created",
        },
      });
      expect(createdResult.success).toBe(true);

      const completedResult = TelemetryEventSchema.safeParse({
        name: "task_action",
        deviceId: validDeviceId,
        properties: {
          action: "completed",
        },
      });
      expect(completedResult.success).toBe(true);
    });

    it("validates valid habit_logged event with or without streak_milestone", () => {
      const withoutMilestone = TelemetryEventSchema.safeParse({
        name: "habit_logged",
        deviceId: validDeviceId,
        properties: {},
      });
      expect(withoutMilestone.success).toBe(true);

      const withMilestone = TelemetryEventSchema.safeParse({
        name: "habit_logged",
        deviceId: validDeviceId,
        properties: {
          streak_milestone: "30",
        },
      });
      expect(withMilestone.success).toBe(true);
    });

    it("validates valid focus_session event", () => {
      const result = TelemetryEventSchema.safeParse({
        name: "focus_session",
        deviceId: validDeviceId,
        properties: {
          status: "completed",
          duration_minutes: 25,
        },
      });
      expect(result.success).toBe(true);
    });

    it("validates valid signup_completed event", () => {
      const withEmptyProps = TelemetryEventSchema.safeParse({
        name: "signup_completed",
        deviceId: validDeviceId,
        properties: {},
      });
      expect(withEmptyProps.success).toBe(true);

      const withoutProps = TelemetryEventSchema.safeParse({
        name: "signup_completed",
        deviceId: validDeviceId,
      });
      expect(withoutProps.success).toBe(true);
    });

    it("rejects invalid event names", () => {
      const result = TelemetryEventSchema.safeParse({
        name: "user_logged_in",
        deviceId: validDeviceId,
        properties: {},
      });
      expect(result.success).toBe(false);
    });

    it("rejects non-UUID deviceId", () => {
      const result = TelemetryEventSchema.safeParse({
        name: "app_opened",
        deviceId: "not-a-uuid",
        properties: {
          display_mode: "browser",
          platform: "desktop",
        },
      });
      expect(result.success).toBe(false);
    });

    it("rejects unknown properties / PII injection in events (strict mode)", () => {
      const result = TelemetryEventSchema.safeParse({
        name: "task_action",
        deviceId: validDeviceId,
        properties: {
          action: "created",
          task_title: "My secret task",
        },
      });
      expect(result.success).toBe(false);
    });

    it("rejects unknown top-level properties on event object", () => {
      const result = TelemetryEventSchema.safeParse({
        name: "task_action",
        deviceId: validDeviceId,
        user_email: "user@example.com",
        properties: {
          action: "created",
        },
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid enum values", () => {
      const result = TelemetryEventSchema.safeParse({
        name: "app_opened",
        deviceId: validDeviceId,
        properties: {
          display_mode: "fullscreen",
          platform: "windows",
        },
      });
      expect(result.success).toBe(false);
    });

    it("rejects out-of-range focus_session duration_minutes", () => {
      const tooLow = TelemetryEventSchema.safeParse({
        name: "focus_session",
        deviceId: validDeviceId,
        properties: {
          status: "completed",
          duration_minutes: 0,
        },
      });
      expect(tooLow.success).toBe(false);

      const tooHigh = TelemetryEventSchema.safeParse({
        name: "focus_session",
        deviceId: validDeviceId,
        properties: {
          status: "completed",
          duration_minutes: 721,
        },
      });
      expect(tooHigh.success).toBe(false);
    });
  });

  describe("TelemetryBatchRequestSchema", () => {
    it("validates a batch containing valid events", () => {
      const result = TelemetryBatchRequestSchema.safeParse({
        events: [
          {
            name: "app_opened",
            deviceId: validDeviceId,
            properties: {
              display_mode: "browser",
              platform: "desktop",
            },
          },
          {
            name: "task_action",
            deviceId: validDeviceId,
            properties: {
              action: "completed",
            },
          },
        ],
      });

      expect(result.success).toBe(true);
    });

    it("accepts an empty events batch", () => {
      const result = TelemetryBatchRequestSchema.safeParse({
        events: [],
      });
      expect(result.success).toBe(true);
    });

    it("rejects batches with more than 50 events", () => {
      const events = Array.from({ length: 51 }, () => ({
        name: "task_action" as const,
        deviceId: validDeviceId,
        properties: {
          action: "created" as const,
        },
      }));

      const result = TelemetryBatchRequestSchema.safeParse({ events });
      expect(result.success).toBe(false);
    });

    it("rejects non-array events field", () => {
      const result = TelemetryBatchRequestSchema.safeParse({
        events: "not an array",
      });
      expect(result.success).toBe(false);
    });

    it("rejects unknown top-level keys in batch request", () => {
      const result = TelemetryBatchRequestSchema.safeParse({
        events: [],
        extra_key: 123,
      });
      expect(result.success).toBe(false);
    });
  });
});
