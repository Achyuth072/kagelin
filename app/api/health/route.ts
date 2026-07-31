import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Public route (middleware.ts isPublicRoute) so an unauthenticated monitor
// gets a real 200/503 instead of a redirect to /login.
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
