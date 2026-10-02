/**
 * Message catalogs are split per namespace (src/messages/<locale>/<ns>.json)
 * and merged here. Add a namespace to NAMESPACES and create both files.
 */
export const NAMESPACES = [
  "common",
  "nav",
  "auth",
  "onboarding",
  "setup",
  "errors",
  "enums",
  "ui",
  "notifications",
  "properties",
  "units",
  "tenants",
  "owners",
  "catalog",
  "documents",
  "contracts",
  "collections",
  "payments",
  "expenses",
  "deposits",
  "dashboard",
  "reports",
  "legal",
  "settings",
  "audit",
  "portal",
  "pwa",
] as const;

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
import type setup from "./ar/setup.json";
import type errors from "./ar/errors.json";
import type enums from "./ar/enums.json";
import type ui from "./ar/ui.json";
import type notifications from "./ar/notifications.json";
import type properties from "./ar/properties.json";
import type units from "./ar/units.json";
import type tenants from "./ar/tenants.json";
import type owners from "./ar/owners.json";
import type catalog from "./ar/catalog.json";
import type documents from "./ar/documents.json";
import type contracts from "./ar/contracts.json";
import type collections from "./ar/collections.json";
import type payments from "./ar/payments.json";
import type expenses from "./ar/expenses.json";
import type deposits from "./ar/deposits.json";
import type dashboard from "./ar/dashboard.json";
import type reports from "./ar/reports.json";
import type legal from "./ar/legal.json";
import type settings from "./ar/settings.json";
import type audit from "./ar/audit.json";
import type portal from "./ar/portal.json";
import type pwa from "./ar/pwa.json";

export interface Messages {
  common: typeof common;
  nav: typeof nav;
  auth: typeof auth;
  onboarding: typeof onboarding;
  setup: typeof setup;
  errors: typeof errors;
  enums: typeof enums;
  ui: typeof ui;
  notifications: typeof notifications;
  properties: typeof properties;
  units: typeof units;
  tenants: typeof tenants;
  owners: typeof owners;
  catalog: typeof catalog;
  documents: typeof documents;
  contracts: typeof contracts;
  collections: typeof collections;
  payments: typeof payments;
  expenses: typeof expenses;
  deposits: typeof deposits;
  dashboard: typeof dashboard;
  reports: typeof reports;
  legal: typeof legal;
  settings: typeof settings;
  audit: typeof audit;
  portal: typeof portal;
  pwa: typeof pwa;
}
