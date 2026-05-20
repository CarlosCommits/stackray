export interface Stat {
  label: string
  value: string
  icon?: "active" | "runs" | "targets" | "technologies"
  href?: string
  subvalue?: string
  change?: string
  progress?: number
  bars?: number[]
  latest?: string
  status?: string
  uptime?: string
  inFlight?: number
  indicator?: "trend-up" | "trend-down" | "pulse" | "static"
  meta?: string
  sparkline?: number[]
}

export interface RecentScan {
  id: string
  target: string
  ip: string
  status: "complete" | "analyzing" | "failed"
  phase: "queued" | "httpx" | "enrichment" | "complete" | "failed"
  phaseLabel: string
  phaseDescription?: string
  technologies?: string[]
  timestamp: string
  progress?: number
  error?: string
  isNew?: boolean
  // Richer summary signals
  statusCode?: number
  server?: string
  cdn?: string
  redirectCount?: number
  responseTimeMs?: number
  techCount?: number
  faviconUrl?: string | null
}

export interface RecentScansPage {
  items: RecentScan[]
  nextCursor: string | null
}
