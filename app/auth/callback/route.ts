import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sanitizeNextPath } from "@/lib/auth/safe-redirect";
import { EMAIL_CONFIRMED_PATH } from "@/lib/auth/auth-routes";

// Redirects to `next` so page-local error UI can render — except
// /auth/email-confirmed, which has none, so that falls back to /login.
// `errorCode` is GoTrue's stable error identifier (e.g.
// "identity_already_exists"), forwarded alongside the prose `message` so the
// client can branch on the code instead of matching the message text.
function redirectWithError(
  origin: string,
  next: string,
  message: string,
  errorCode?: string | null,
) {
  const target =
    next === "/" || next === EMAIL_CONFIRMED_PATH ? "/login" : next;
  const url = new URL(target, origin);
  // Defense-in-depth: sanitizeNextPath should already guarantee same-origin,
  // but this is the one call site where `next` reaches new URL(relative, base).
  if (url.origin !== origin) {
    return NextResponse.redirect(new URL("/login", origin));
  }
  url.searchParams.set("error", message);
  if (errorCode) url.searchParams.set("error_code", errorCode);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorDescription = searchParams.get("error_description");
  const errorCode = searchParams.get("error_code");
  const next = sanitizeNextPath(searchParams.get("next"));

  if (errorDescription) {
    return redirectWithError(origin, next, errorDescription, errorCode);
  }

  if (code) {
    // GoTrue already confirmed the email before this redirect, so no
    // exchange is needed — skip it and no session ever lands in this browser.
    if (next === EMAIL_CONFIRMED_PATH) {
      return NextResponse.redirect(`${origin}${next}`);
    }

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
      return redirectWithError(origin, next, error.message, error.code);
    }

    const response = NextResponse.redirect(`${origin}${next}`);
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });

    return response;
  }

  return redirectWithError(origin, next, "no_code_received");
}
