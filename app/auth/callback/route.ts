import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sanitizeNextPath } from "@/lib/auth/safe-redirect";

// Redirects to `next` instead of always /login, so page-local error UI
// (e.g. AccountSection's formatLinkError) gets a chance to render.
function redirectWithError(origin: string, next: string, message: string) {
  const target = next === "/" ? "/login" : next;
  const url = new URL(target, origin);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorDescription = searchParams.get("error_description");
  const next = sanitizeNextPath(searchParams.get("next"));

  if (errorDescription) {
    return redirectWithError(origin, next, errorDescription);
  }

  if (code) {
    const cookieStore = await cookies();

    const cookiesToSet: Array<{
      name: string;
      value: string;
      options: Record<string, unknown>;
    }> = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookies) {
            cookiesToSet.push(
              ...cookies.map((c) => ({
                name: c.name,
                value: c.value,
                options: c.options as Record<string, unknown>,
              })),
            );
            // Also try to set on cookieStore (may silently fail)
            try {
              cookies.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options),
              );
            } catch {
              // Expected to fail in Route Handler context
            }
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return redirectWithError(origin, next, error.message);
    }

    // Create redirect response and manually attach all session cookies
    const response = NextResponse.redirect(`${origin}${next}`);
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });

    return response;
  }

  return redirectWithError(origin, next, "no_code_received");
}
