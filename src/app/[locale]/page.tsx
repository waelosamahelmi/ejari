import { redirect } from "next/navigation";
import { getAuthUser, getSessionContext } from "@/lib/auth";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getAuthUser();
  if (!user) redirect(`/${locale}/login`);
  const ctx = await getSessionContext();
  if (!ctx) redirect(`/${locale}/setup`);
  redirect(`/${locale}/${ctx.role === "owner" ? "owner" : "dashboard"}`);
}
