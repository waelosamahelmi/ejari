import { NextResponse, type NextRequest } from "next/server";

/**
 * Share-target fallback: normally the service worker intercepts POST /share and
 * stores the files on the device. If it isn't active yet, explain on the share page.
 */
export async function POST(req: NextRequest) {
  const lang = req.cookies.get("NEXT_LOCALE")?.value === "en" ? "en" : "ar";
  return NextResponse.redirect(new URL(`/${lang}/share?unsupported=1`, req.url), 303);
}
