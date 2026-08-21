import { NextResponse } from "next/server";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { TelemetryBatchRequestSchema } from "@/lib/schemas/telemetry";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    // 1. IP rate limiting (evaluated in-memory/Upstash and discarded immediately)
    const clientIp = getClientIp(request);
    const limited = await enforceRateLimit("telemetry", clientIp);
    if (limited) return limited;

    // 2. Body parsing
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // 3. Schema validation (strict check rejects unknown keys, PII, and oversized payloads)
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

    // 4. Transform into database rows (strictly zero IP or PII persisted)
    const rows = events.map((event) => ({
      device_id: event.deviceId,
      event_name: event.name,
      properties:
        "properties" in event && event.properties ? event.properties : {},
    }));

    // 5. Ingestion via privileged admin client (bypasses RLS)
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
