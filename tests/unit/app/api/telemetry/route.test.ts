import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { POST } from "@/../app/api/telemetry/route";

const mockFrom = vi.fn();
const mockInsert = vi.fn();

const mockSupabase = {
  from: mockFrom,
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => mockSupabase),
}));

const mockEnforceRateLimit = vi.fn();
const mockGetClientIp = vi.fn();

vi.mock("@/lib/rate-limit", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/rate-limit")>(
      "@/lib/rate-limit",
    );
  return {
    ...actual,
    enforceRateLimit: (...args: unknown[]) => mockEnforceRateLimit(...args),
    getClientIp: (...args: unknown[]) => mockGetClientIp(...args),
  };
});

describe("POST /api/telemetry", () => {
  const validDeviceId = "123e4567-e89b-12d3-a456-426614174000";

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClientIp.mockReturnValue("192.0.2.1");
    mockEnforceRateLimit.mockResolvedValue(null);
    mockFrom.mockReturnValue({
      insert: mockInsert,
    });
    mockInsert.mockResolvedValue({ error: null });
  });

  it("inserts valid batch of events into telemetry_events table without storing IP", async () => {
    const payload = {
      events: [
        {
          name: "app_opened",
          deviceId: validDeviceId,
          properties: {
            display_mode: "standalone",
            platform: "ios",
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
    };

    const request = new Request("http://localhost/api/telemetry", {
      method: "POST",
      headers: {
        "x-forwarded-for": "192.0.2.1",
      },
      body: JSON.stringify(payload),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      count: 2,
    });

    expect(mockGetClientIp).toHaveBeenCalledWith(request);
    expect(mockEnforceRateLimit).toHaveBeenCalledWith("telemetry", "192.0.2.1");
    expect(mockFrom).toHaveBeenCalledWith("telemetry_events");
    expect(mockInsert).toHaveBeenCalledWith([
      {
        device_id: validDeviceId,
        event_name: "app_opened",
        properties: {
          display_mode: "standalone",
          platform: "ios",
        },
      },
      {
        device_id: validDeviceId,
        event_name: "task_action",
        properties: {
          action: "completed",
        },
      },
    ]);

    // Ensure IP is never written to DB rows
    const insertedRows = mockInsert.mock.calls[0][0];
    for (const row of insertedRows) {
      expect(row).not.toHaveProperty("ip");
      expect(row).not.toHaveProperty("client_ip");
      expect(row).not.toHaveProperty("ip_address");
      expect(JSON.stringify(row)).not.toContain("192.0.2.1");
    }
  });

  it("returns 200 count 0 for an empty batch without calling database insert", async () => {
    const request = new Request("http://localhost/api/telemetry", {
      method: "POST",
      body: JSON.stringify({ events: [] }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, count: 0 });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limit is exceeded and does not touch database", async () => {
    mockEnforceRateLimit.mockResolvedValue(
      NextResponse.json({ error: "Too many requests" }, { status: 429 }),
    );

    const request = new Request("http://localhost/api/telemetry", {
      method: "POST",
      body: JSON.stringify({
        events: [
          {
            name: "app_opened",
            deviceId: validDeviceId,
            properties: { display_mode: "browser", platform: "desktop" },
          },
        ],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(429);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns 400 on malformed JSON body", async () => {
    const request = new Request("http://localhost/api/telemetry", {
      method: "POST",
      body: "{ not-valid-json",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid event schema (e.g. unknown properties / PII injection)", async () => {
    const request = new Request("http://localhost/api/telemetry", {
      method: "POST",
      body: JSON.stringify({
        events: [
          {
            name: "task_action",
            deviceId: validDeviceId,
            properties: {
              action: "created",
              task_title: "Secret confidential task",
            },
          },
        ],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns 400 when batch exceeds maximum size of 50", async () => {
    const events = Array.from({ length: 51 }, () => ({
      name: "task_action" as const,
      deviceId: validDeviceId,
      properties: {
        action: "created" as const,
      },
    }));

    const request = new Request("http://localhost/api/telemetry", {
      method: "POST",
      body: JSON.stringify({ events }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns 500 when database insertion fails", async () => {
    mockInsert.mockResolvedValue({
      error: { message: "Database connection failed" },
    });

    const request = new Request("http://localhost/api/telemetry", {
      method: "POST",
      body: JSON.stringify({
        events: [
          {
            name: "signup_completed",
            deviceId: validDeviceId,
          },
        ],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });
});
