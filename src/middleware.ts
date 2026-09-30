import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { routing } from "./i18n/routing";

const intl = createIntlMiddleware(routing);

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/welcome", "/auth", "/offline", "/forbidden", "/opengraph-image", "/dev/brand"];

export async function middleware(request: NextRequest) {
  const response = intl(request);
  // Locale redirects (e.g. "/" → "/ar") are returned as-is.
  if (response.headers.get("location")) return response;

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [, locale = routing.defaultLocale, ...rest] = request.nextUrl.pathname.split("/");
  const sub = `/${rest.join("/")}`;
  const isPublic = sub === "/" ? false : PUBLIC_PATHS.some((p) => sub === p || sub.startsWith(`${p}/`));
  if (!user && !isPublic && !sub.startsWith("/dev/brand")) {
    const target = request.nextUrl.clone();
    target.pathname = `/${locale}/${request.cookies.get("ijari-onboarded") ? "login" : "welcome"}`;
    target.search = sub !== "/" ? `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}` : "";
    const redirect = NextResponse.redirect(target);
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|print|share|_next|_vercel|sw.js|swe-worker|manifest.webmanifest|icons|splash|brand|.*\\..*).*)"],
};
