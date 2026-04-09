/**
 * Tour step definitions for the Stackray onboarding tours.
 *
 * Each step targets a `data-tour` attribute on an existing UI element.
 * The `route` field determines which tour activates on which path.
 */

export interface TourStep {
  /** Matches a `data-tour="<target>"` attribute on a DOM element. */
  target: string
  content: string
  title?: string
  placement?: "top" | "bottom" | "left" | "right"
}

export interface TourConfig {
  id: string
  route: string
  steps: TourStep[]
}

export const tours: TourConfig[] = [
  {
    id: "dashboard-quick-scan",
    route: "/dashboard",
    steps: [
      {
        target: "dashboard-search",
        title: "Quick scan",
        content:
          "Enter a domain or URL here to start a scan immediately, or leave it empty to open the full scan form.",
        placement: "bottom",
      },
      {
        target: "dashboard-stats",
        title: "Metrics at a glance",
        content:
          "These cards show your total targets, completed scans, and active scans. Click a card to drill down.",
        placement: "bottom",
      },
      {
        target: "dashboard-recent-scans",
        title: "Recent activity",
        content:
          "Your latest scans appear here so you can jump straight to the results.",
        placement: "bottom",
      },
    ],
  },
  {
    id: "tokens-quickstart",
    route: "/settings/tokens",
    steps: [
      {
        target: "tokens-create-form",
        title: "Create a token",
        content:
          "Give your token a name and click Create. The token value is shown only once — store it somewhere safe.",
        placement: "right",
      },
      {
        target: "tokens-list",
        title: "Manage tokens",
        content:
          "Active tokens appear here. You can delete any token you no longer need.",
        placement: "left",
      },
      {
        target: "tokens-quickstart-card",
        title: "API quickstart",
        content:
          "This card links to the full API docs and token management reference.",
        placement: "right",
      },
    ],
  },
  {
    id: "users-management",
    route: "/settings/users",
    steps: [
      {
        target: "users-create-form",
        title: "Create users",
        content:
          "Fill in the details and choose a role. You can send credentials via email or generate a temporary password.",
        placement: "bottom",
      },
      {
        target: "users-table",
        title: "Manage users",
        content:
          "Change roles, toggle API token access, reset passwords, or remove users from this table.",
        placement: "top",
      },
    ],
  },
]

export function getTourById(id: string): TourConfig | undefined {
  return tours.find((t) => t.id === id)
}

export function getTourForRoute(pathname: string): TourConfig | undefined {
  return tours.find((t) => pathname === t.route || pathname.startsWith(`${t.route}/`))
}