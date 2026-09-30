import { defineRouting } from "next-intl/routing";
import { APP } from "@/config/app";

export const routing = defineRouting({
  locales: APP.locales,
  defaultLocale: APP.defaultLocale,
  localePrefix: "always",
});
