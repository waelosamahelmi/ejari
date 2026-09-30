import type ar from "./messages/ar.json";

declare module "next-intl" {
  interface AppConfig {
    Messages: typeof ar;
    Locale: "ar" | "en";
  }
}
