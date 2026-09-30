import "server-only";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { signPath } from "@/server/storage";

/** Auth for print routes (outside the locale segment, so the middleware doesn't guard them). */
export async function requirePrintContext(lang: string | undefined) {
  const ctx = await getSessionContext();
  if (!ctx) redirect(`/${lang === "en" ? "en" : "ar"}/login`);
  const logoUrl = ctx.orgLogo ? await signPath("branding", ctx.orgLogo) : null;
  return { ctx, logoUrl, lang: (lang === "en" ? "en" : "ar") as "ar" | "en" };
}
