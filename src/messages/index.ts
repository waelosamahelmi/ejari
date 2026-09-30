/**
 * Message catalogs are split per namespace (src/messages/<locale>/<ns>.json)
 * and merged here. Add a namespace to NAMESPACES and create both files.
 */
export const NAMESPACES = ["common", "nav", "auth", "onboarding", "errors", "enums", "ui", "notifications"] as const;

export type Locale = "ar" | "en";

export async function loadMessages(locale: Locale) {
  const entries = await Promise.all(
    NAMESPACES.map(async (ns) => [ns, (await import(`./${locale}/${ns}.json`)).default] as const),
  );
  return Object.fromEntries(entries) as Messages;
}

import type common from "./ar/common.json";
import type nav from "./ar/nav.json";
import type auth from "./ar/auth.json";
import type onboarding from "./ar/onboarding.json";
import type errors from "./ar/errors.json";
import type enums from "./ar/enums.json";
import type ui from "./ar/ui.json";
import type notifications from "./ar/notifications.json";

export interface Messages {
  common: typeof common;
  nav: typeof nav;
  auth: typeof auth;
  onboarding: typeof onboarding;
  errors: typeof errors;
  enums: typeof enums;
  ui: typeof ui;
  notifications: typeof notifications;
}
