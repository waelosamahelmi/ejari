import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const ctx = await getSessionContext();
  if (!ctx) redirect(`/${locale}/login`);
  redirect(`/${locale}/${ctx.role === "owner" ? "owner" : "dashboard"}`);
}
