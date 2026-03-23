export interface Stat {
  label: string
  value: string
  change?: string
  progress?: number
  bars?: number[]
  latest?: string
  status?: string
  uptime?: string
  inFlight?: number
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
}
