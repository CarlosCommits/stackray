import type { RecentScan, Stat } from "@/components/dashboard/types"

export const stats: Stat[] = [
  { 
    label: "Total Scans", 
    value: "12,842", 
    subvalue: "24h",
    change: "+12.4%", 
    indicator: "trend-up",
    meta: "All time"
  },
  { 
    label: "Scans In Flight", 
    value: "3", 
    subvalue: "active",
    indicator: "pulse",
    meta: "2 queued"
  },
  { 
    label: "Targets Changed", 
    value: "47", 
    subvalue: "since yesterday",
    change: "+8",
    indicator: "trend-up",
    meta: "New detections"
  },
  { 
    label: "High-Confidence Hits", 
    value: "1,247", 
    subvalue: "verified",
    change: "+3.2%",
    indicator: "static",
    meta: "Stack identified"
  },
]

export const recentScans: RecentScan[] = [
  {
    id: "1",
    target: "stripe.com",
    ip: "34.201.21.144",
    status: "complete",
    technologies: ["React", "Go", "Stripe", "AWS", "Nginx"],
    techCount: 5,
    timestamp: "2024.05.21 14:02",
    statusCode: 200,
    server: "Nginx",
    cdn: "CloudFront",
    redirectCount: 0,
    responseTimeMs: 187,
  },
  {
    id: "2",
    target: "github.com",
    ip: "140.82.121.3",
    status: "analyzing",
    technologies: ["Ruby", "MySQL"],
    techCount: 2,
    timestamp: "2024.05.21 13:58",
    progress: 67,
  },
  {
    id: "3",
    target: "vercel.app",
    ip: "76.76.21.21",
    status: "complete",
    technologies: ["Next.js", "Vercel", "React"],
    techCount: 3,
    timestamp: "2024.05.21 12:44",
    statusCode: 200,
    server: "Vercel",
    cdn: "Vercel Edge",
    redirectCount: 1,
    responseTimeMs: 94,
  },
  {
    id: "4",
    target: "openai.com",
    ip: "104.18.7.192",
    status: "failed",
    error: "Connection timeout after 30s",
    timestamp: "2024.05.21 11:30",
  },
]
