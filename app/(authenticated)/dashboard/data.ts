import type { RecentScan, Stat } from "@/components/dashboard/types"

export const stats: Stat[] = [
  { label: "Aggregate Scans", value: "12,842", change: "+12.4%", progress: 75 },
  { label: "Targets Identified", value: "4,910", bars: [100, 60, 30, 10] },
  { label: "Technology Index", value: "842", latest: "Astro v4.5.1" },
  { label: "Scans In Flight", value: "3", inFlight: 3, status: "ACTIVE_NODES" },
]

export const recentScans: RecentScan[] = [
  {
    id: "1",
    target: "payments.example.test",
    ip: "34.201.21.144",
    status: "complete",
    technologies: ["React", "Go", "Stripe", "AWS"],
    timestamp: "2024.05.21 14:02",
  },
  {
    id: "2",
    target: "github.com",
    ip: "140.82.121.3",
    status: "analyzing",
    technologies: ["Ruby", "MySQL"],
    timestamp: "2024.05.21 13:58",
    progress: 33,
  },
  {
    id: "3",
    target: "vercel.app",
    ip: "76.76.21.21",
    status: "complete",
    technologies: ["Next.js", "Vercel"],
    timestamp: "2024.05.21 12:44",
  },
  {
    id: "4",
    target: "openai.com",
    ip: "104.18.7.192",
    status: "failed",
    error: "Timed out after 30s",
    timestamp: "2024.05.21 11:30",
  },
]
