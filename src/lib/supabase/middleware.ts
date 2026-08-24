import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const isGuest = request.cookies.get("kanso_guest_mode")?.value === "true";
  if (isGuest) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // redirect() builds a fresh response, so cookies Supabase wrote onto
  // supabaseResponse must be copied across or the browser loops on a stale one.
  const redirectToLogin = () => {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    for (const cookie of supabaseResponse.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  };

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Distinct from AUTH_STANDALONE_ROUTES: gates server auth redirects
  // (covering /access-denied and /api/health), not client shell rendering.
  const isPublicRoute =
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname === "/signup" ||
    request.nextUrl.pathname === "/access-denied" ||
    request.nextUrl.pathname.startsWith("/auth/") ||
    // Uptime checks send no cookies.
    request.nextUrl.pathname === "/api/health";

  if (error && !isPublicRoute && !isGuest) {
    // Redirecting while offline creates an infinite loop.
    const isNetworkError =
      error.message?.toLowerCase().includes("fetch") ||
      error.status === 0 ||
      !error.status;

    if (isNetworkError) {
      return supabaseResponse;
    }

    await supabase.auth.signOut();
    return redirectToLogin();
  }

  if (!user && !isPublicRoute && !isGuest) {
    return redirectToLogin();
  }

  return supabaseResponse;
}
