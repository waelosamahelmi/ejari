import { useTranslations } from "next-intl";

export default function Home() {
  const t = useTranslations("app");
  return (
    <main className="grid min-h-dvh place-items-center">
      <h1 className="text-4xl font-semibold">{t("name")}</h1>
    </main>
  );
}
