export interface Stat {
  label: string
  value: string
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
}

export interface RecentScan {
  id: string
  target: string
  ip: string
  status: "complete" | "analyzing" | "failed"
  technologies?: string[]
  timestamp: string
  progress?: number
  error?: string
  // Richer summary signals
  statusCode?: number
  server?: string
  cdn?: string
  redirectCount?: number
  responseTimeMs?: number
  techCount?: number
}
