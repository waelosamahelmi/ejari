"use client";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { OnboardingPager } from "@/components/ui/onboarding-pager";
import { PHOTOS } from "@/config/generated-assets";
import { markOnboarded } from "@/server/actions/preferences";

export default function WelcomePage() {
  const t = useTranslations("onboarding");
  const tApp = useTranslations("common.app");
  const router = useRouter();
  const raw = t.raw("slides") as { title: string; strong: string; subtitle: string }[];
  const photos = [PHOTOS["hero-dusk"], PHOTOS["hero-villa"], PHOTOS["hero-evening"]];
  const slides = raw.map((s, i) => ({ ...s, photo: photos[i]! }));
  const toLogin = async () => {
    await markOnboarded();
    router.push("/login");
  };
  const start = async () => {
    await markOnboarded();
    router.push(process.env.NEXT_PUBLIC_ALLOW_SIGNUP === "false" ? "/login" : "/signup");
  };
  return (
    <OnboardingPager
      slides={slides}
      primaryLabel={t("start")}
      secondaryLabel={t("login")}
      onPrimary={() => void start()}
      onSecondary={() => void toLogin()}
      pageLabel={(n, total) => t("page", { n, total })}
      logo={
        <>
          <Image
            src="/brand/lockup-ar-white.svg"
            alt={tApp("fullName")}
            width={120}
            height={36}
            className="h-8 w-auto ltr:hidden"
            priority
          />
          <Image
            src="/brand/lockup-en-white.svg"
            alt={tApp("fullName")}
            width={120}
            height={36}
            className="h-8 w-auto rtl:hidden"
            priority
          />
        </>
      }
    />
  );
}
