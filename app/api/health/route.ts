import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Public route (see middleware.ts's isPublicRoute) so an external monitor
 * with no session/guest cookie gets a real 200/503 instead of a redirect to
 * /login. Pings Postgres via a head-only request so a DB outage is caught,
 * not just "the Next.js server is up."
 */
export async function GET() {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .select("id", { head: true });

  if (error) {
    return NextResponse.json(
      { status: "error", database: "unreachable" },
      { status: 503 },
    );
  }

  return NextResponse.json({ status: "ok" });
}
