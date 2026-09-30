import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Magic link / recovery / invite landing: exchanges the code for a session. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  const url = request.nextUrl;
  const next = url.searchParams.get("next");
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : `/${locale}/dashboard`;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as "magiclink" | "recovery" | "invite" | "email" | null;
  const supabase = await supabaseServer();
  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type)
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  const dest = new URL(ok ? safeNext : `/${locale}/login?error=link`, url.origin);
  if (type === "recovery" || type === "invite") dest.pathname = `/${locale}/reset-password`;
  return NextResponse.redirect(dest);
}
