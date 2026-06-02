import {
  Activity,
  CalendarClock,
  KeyRound,
  LayoutGrid,
  Layers,
  PlayCircle,
  Scan,
  Users,
} from "lucide-react"
import type { ComponentType } from "react"

export type NavigationToneKey =
  | "active"
  | "dashboard"
  | "runs"
  | "schedules"
  | "settings"
  | "targets"
  | "technologies"
  | "users"

interface NavigationTone {
  active: string
  hover: string
  icon: string
  shell: string
  sparkline: {
    glow: string
    stroke: string
  }
}

interface NavigationVisual {
  icon: ComponentType<{ className?: string }>
  tone: NavigationToneKey
}

export const NAVIGATION_TONES: Record<NavigationToneKey, NavigationTone> = {
  active: {
    active: "text-amber-300 bg-amber-400/10",
    hover: "hover:text-amber-300 hover:bg-amber-400/10",
    icon: "text-amber-300",
    shell: "bg-amber-400/10 ring-amber-300/15",
    sparkline: {
      glow: "rgba(251, 191, 36, 0.55)",
      stroke: "#fbbf24",
    },
  },
  dashboard: {
    active: "text-amber-300 bg-amber-400/10",
    hover: "hover:text-amber-300 hover:bg-amber-400/10",
    icon: "text-amber-300",
    shell: "bg-amber-400/10 ring-amber-300/15",
    sparkline: {
      glow: "rgba(251, 191, 36, 0.55)",
      stroke: "#fbbf24",
    },
  },
  runs: {
    active: "text-cyan-300 bg-cyan-400/10",
    hover: "hover:text-cyan-300 hover:bg-cyan-400/10",
    icon: "text-cyan-300",
    shell: "bg-cyan-400/10 ring-cyan-300/15",
    sparkline: {
      glow: "rgba(103, 232, 249, 0.5)",
      stroke: "#67e8f9",
    },
  },
  schedules: {
    active: "text-teal-300 bg-teal-400/10",
    hover: "hover:text-teal-300 hover:bg-teal-400/10",
    icon: "text-teal-300",
    shell: "bg-teal-400/10 ring-teal-300/15",
    sparkline: {
      glow: "rgba(94, 234, 212, 0.5)",
      stroke: "#5eead4",
    },
  },
  settings: {
    active: "text-blue-300 bg-blue-400/10",
    hover: "hover:text-red-300 hover:bg-red-400/10",
    icon: "text-blue-300",
    shell: "bg-blue-400/10 ring-blue-300/15",
    sparkline: {
      glow: "rgba(147, 197, 253, 0.5)",
      stroke: "#93c5fd",
    },
  },
  targets: {
    active: "text-emerald-300 bg-emerald-400/10",
    hover: "hover:text-emerald-300 hover:bg-emerald-400/10",
    icon: "text-emerald-300",
    shell: "bg-emerald-400/10 ring-emerald-300/15",
    sparkline: {
      glow: "rgba(110, 231, 183, 0.5)",
      stroke: "#6ee7b7",
    },
  },
  technologies: {
    active: "text-violet-300 bg-violet-400/10",
    hover: "hover:text-violet-300 hover:bg-violet-400/10",
    icon: "text-violet-300",
    shell: "bg-violet-400/10 ring-violet-300/15",
    sparkline: {
      glow: "rgba(196, 181, 253, 0.5)",
      stroke: "#c4b5fd",
    },
  },
  users: {
    active: "text-fuchsia-300 bg-fuchsia-400/10",
    hover: "hover:text-fuchsia-300 hover:bg-fuchsia-400/10",
    icon: "text-fuchsia-300",
    shell: "bg-fuchsia-400/10 ring-fuchsia-300/15",
    sparkline: {
      glow: "rgba(240, 171, 252, 0.5)",
      stroke: "#f0abfc",
    },
  },
}

export const NAVIGATION_VISUALS = {
  active: { icon: Activity, tone: "active" },
  dashboard: { icon: LayoutGrid, tone: "dashboard" },
  runs: { icon: PlayCircle, tone: "runs" },
  schedules: { icon: CalendarClock, tone: "schedules" },
  settings: { icon: KeyRound, tone: "settings" },
  targets: { icon: Scan, tone: "targets" },
  technologies: { icon: Layers, tone: "technologies" },
  users: { icon: Users, tone: "users" },
} satisfies Record<NavigationToneKey, NavigationVisual>
