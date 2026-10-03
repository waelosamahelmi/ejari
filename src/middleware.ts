import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { routing } from "./i18n/routing";

const intl = createIntlMiddleware(routing);

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/welcome",
  "/privacy",
  "/terms",
  "/auth",
  "/offline",
  "/forbidden",
  "/opengraph-image",
  "/dev/brand",
];

export async function middleware(request: NextRequest) {
  const response = intl(request);
  // Locale redirects (e.g. "/" → "/ar") are returned as-is.
  if (response.headers.get("location")) return response;

  const [, locale = routing.defaultLocale, ...rest] = request.nextUrl.pathname.split("/");
  const sub = `/${rest.join("/")}`;
  const isPublic =
    sub === "/" ? false : PUBLIC_PATHS.some((p) => sub === p || sub.startsWith(`${p}/`));
  // Public pages (login, signup, legal…) need no session check at all.
  if (isPublic || sub.startsWith("/dev/brand")) return response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  // Local JWKS verification (no Auth round trip); falls back to the Auth server
  // for legacy HS256 projects.
  let signedIn = false;
  try {
    const { data, error } = await supabase.auth.getClaims();
    signedIn = !error && !!data?.claims?.sub;
    if (!signedIn && error) {
      const { data: fallback } = await supabase.auth.getUser();
      signedIn = !!fallback.user;
    }
  } catch {
    const { data } = await supabase.auth.getUser();
    signedIn = !!data.user;
  }
  if (!signedIn) {
    const target = request.nextUrl.clone();
    target.pathname = `/${locale}/${request.cookies.get("ijari-onboarded") ? "login" : "welcome"}`;
    target.search =
      sub !== "/"
        ? `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`
        : "";
    const redirect = NextResponse.redirect(target);
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!api|print|share|_next|_vercel|sw.js|swe-worker|manifest.webmanifest|icons|splash|brand|.*\\..*).*)",
  ],
};
