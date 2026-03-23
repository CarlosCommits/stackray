import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  History,
  Search,
  Filter,
  Calendar,
  User,
  Clock,
  ChevronRight
} from "lucide-react"

const scanHistory = [
  {
    id: "scan-001",
    target: "stripe.com",
    targetCount: 1,
    status: "complete",
    source: "ui",
    createdBy: "admin",
    duration: "2.4s",
    technologies: ["React", "Go", "AWS"],
    submittedAt: "2024-05-21 14:02:33",
  },
  {
    id: "scan-002",
    target: "github.com",
    targetCount: 1,
    status: "analyzing",
    source: "api",
    createdBy: "api-key-7f3a",
    duration: "--",
    technologies: ["Ruby", "MySQL"],
    submittedAt: "2024-05-21 13:58:12",
  },
  {
    id: "scan-003",
    target: "vercel.app",
    targetCount: 3,
    status: "complete",
    source: "cli",
    createdBy: "dev-team",
    duration: "5.1s",
    technologies: ["Next.js", "Vercel"],
    submittedAt: "2024-05-21 12:44:09",
  },
  {
    id: "scan-004",
    target: "openai.com",
    targetCount: 1,
    status: "failed",
    source: "ui",
    createdBy: "admin",
    duration: "30.0s",
    technologies: [],
    submittedAt: "2024-05-21 11:30:45",
  },
  {
    id: "scan-005",
    target: "api.example.com",
    targetCount: 12,
    status: "complete",
    source: "api",
    createdBy: "automation",
    duration: "18.7s",
    technologies: ["Node.js", "Express", "MongoDB"],
    submittedAt: "2024-05-21 10:15:22",
  },
]

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-[var(--accent)]" />
          <h1 className="font-[var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
            Scan History
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="border-[var(--gray-border)] text-[var(--text-dim)]">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
          <Button size="sm" className="bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-[var(--primary-foreground)]">
            Export
          </Button>
        </div>
      </div>

      <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-dim)]" />
              <Input 
                placeholder="Search targets, IDs, or technologies..."
                className="pl-10 bg-[var(--surface-mid)] border-[var(--gray-border)] text-[var(--foreground)] placeholder:text-[var(--text-dim)]/50"
              />
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--text-dim)]">
              <Calendar className="w-3 h-3" />
              <span>Last 7 days</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {scanHistory.map((scan) => (
              <div 
                key={scan.id}
                className="flex items-center gap-4 p-3 bg-[var(--surface-mid)] border border-[var(--gray-border)] rounded-lg hover:border-[var(--accent)]/40 transition-colors cursor-pointer group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm text-[var(--foreground)] font-medium">
                      {scan.target}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--text-dim)]">
                      ({scan.targetCount} target{scan.targetCount > 1 ? 's' : ''})
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-[var(--text-dim)]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {scan.submittedAt}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {scan.createdBy}
                    </span>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-[var(--gray-border)]">
                      {scan.source}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {scan.technologies.slice(0, 3).map((tech) => (
                    <span 
                      key={tech}
                      className="text-[9px] px-2 py-1 bg-[var(--surface-light)] text-[var(--foreground)] border border-[var(--gray-border)] rounded"
                    >
                      {tech}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-4">
                  {scan.status === "complete" && (
                    <Badge className="text-[9px] px-2 py-0.5 bg-green-500/20 text-green-400 border-green-500/30">
                      {scan.duration}
                    </Badge>
                  )}
                  {scan.status === "analyzing" && (
                    <Badge className="text-[9px] px-2 py-0.5 bg-[var(--accent)] text-[var(--primary-foreground)]">
                      <span className="w-1 h-1 bg-[var(--primary-foreground)] rounded-full animate-ping mr-1" />
                      Analyzing
                    </Badge>
                  )}
                  {scan.status === "failed" && (
                    <Badge variant="outline" className="text-[9px] px-2 py-0.5 border-red-500/40 text-red-400">
                      Failed
                    </Badge>
                  )}
                  <ChevronRight className="w-4 h-4 text-[var(--text-dim)] group-hover:text-[var(--accent)] transition-colors" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
