import { NextResponse } from "next/server";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { TelemetryBatchRequestSchema } from "@/lib/schemas/telemetry";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    // IP is used in-memory only and never persisted
    const clientIp = getClientIp(request);
    const limited = await enforceRateLimit("telemetry", clientIp);
    if (limited) return limited;

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Strict mode rejects unknown keys, PII, and oversized payloads
    const parsed = TelemetryBatchRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid telemetry payload",
          details: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const { events } = parsed.data;
    if (events.length === 0) {
      return NextResponse.json({ success: true, count: 0 }, { status: 200 });
    }

    // Only device id, event name, and properties are persisted
    const rows = events.map((event) => ({
      device_id: event.deviceId,
      event_name: event.name,
      properties:
        "properties" in event && event.properties ? event.properties : {},
    }));

    // Admin client bypasses RLS
    const supabase = createAdminClient();
    const { error: insertError } = await supabase
      .from("telemetry_events")
      .insert(rows);

    if (insertError) {
      console.error("[Telemetry API] Database insert failed:", insertError);
      return NextResponse.json(
        { error: "Failed to store telemetry events" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { success: true, count: rows.length },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error("[Telemetry API] Internal Server Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
