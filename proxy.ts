import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Static assets and worker chunks must bypass session middleware; redirects
    // to /login fail SW precache and break worker script loading on Firefox.
    "/((?!_next/static|_next/image|favicon.ico|sw.js|.*\\.(?:js|map|svg|png|jpg|jpeg|gif|webp|json|wasm|html)$).*)",
  ],
};
