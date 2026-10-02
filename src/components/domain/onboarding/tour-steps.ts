/** Guided tour step definitions (pure data — unit-tested for order and target validity). */

export type TourPlacement = "auto" | "top" | "bottom" | "start" | "end";

export interface TourStep {
  id: string;
  /** Route to navigate to before looking for the target. */
  route?: string;
  /** CSS selector for the highlighted element; missing → centered card. */
  target?: string;
  titleKey: string;
  bodyKey: string;
  placement?: TourPlacement;
}

const TOUR_ROUTES = [
  "/dashboard",
  "/properties",
  "/collections",
  "/contracts",
  "/reports",
  "/settings/install",
] as const;

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: "ring",
    route: "/dashboard",
    target: "[data-tour='dashboard-ring']",
    titleKey: "steps.ring.title",
    bodyKey: "steps.ring.body",
    placement: "bottom",
  },
  {
    id: "filters",
    route: "/dashboard",
    target: "[data-tour='dashboard-filters']",
    titleKey: "steps.filters.title",
    bodyKey: "steps.filters.body",
    placement: "bottom",
  },
  {
    id: "properties",
    route: "/properties",
    target: "[data-tour='properties-list']",
    titleKey: "steps.properties.title",
    bodyKey: "steps.properties.body",
    placement: "top",
  },
  {
    id: "nav",
    route: "/dashboard",
    target: "[data-tour='nav']",
    titleKey: "steps.nav.title",
    bodyKey: "steps.nav.body",
    placement: "auto",
  },
  {
    id: "collections",
    route: "/collections",
    target: "[data-tour='collections-header']",
    titleKey: "steps.collections.title",
    bodyKey: "steps.collections.body",
    placement: "bottom",
  },
  {
    id: "payment",
    route: "/collections",
    target: "[data-tour='collections-rows']",
    titleKey: "steps.payment.title",
    bodyKey: "steps.payment.body",
    placement: "top",
  },
  {
    id: "contracts",
    route: "/contracts",
    target: "[data-tour='contracts-new']",
    titleKey: "steps.contracts.title",
    bodyKey: "steps.contracts.body",
    placement: "bottom",
  },
  {
    id: "reports",
    route: "/reports",
    target: "[data-tour='reports-grid']",
    titleKey: "steps.reports.title",
    bodyKey: "steps.reports.body",
    placement: "top",
  },
  {
    id: "notifications",
    route: "/dashboard",
    target: "[data-tour='notifications']",
    titleKey: "steps.notifications.title",
    bodyKey: "steps.notifications.body",
    placement: "bottom",
  },
  {
    id: "install",
    route: "/settings/install",
    target: "[data-tour='install-card']",
    titleKey: "steps.install.title",
    bodyKey: "steps.install.body",
    placement: "bottom",
  },
  {
    id: "finish",
    route: "/dashboard",
    titleKey: "steps.finish.title",
    bodyKey: "steps.finish.body",
  },
] as const;

export const TOUR_ROUTE_SET: readonly string[] = TOUR_ROUTES;
