import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Search, 
  Activity,
  ExternalLink, 
  RefreshCw, 
  Bookmark,
  Plus
} from "lucide-react"

const stats = [
  { label: "Aggregate Scans", value: "12,842", change: "+12.4%", progress: 75 },
  { label: "Targets Identified", value: "4,910", bars: [100, 60, 30, 10] },
  { label: "Technology Index", value: "842", latest: "Astro v4.5.1" },
  { label: "API Latency", value: "12ms", status: "STABLE_NODE", uptime: "99.9%" },
]

const recentScans = [
  {
    id: "1",
    target: "stripe.com",
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

const savedShortcuts = [
  { name: "fintech-stack-24", count: "42t" },
  { name: "crypto-vuln-map", count: "105t" },
  { name: "high-traffic-us-east", count: "12t" },
]

const systemNodes = [
  { name: "Scanner-US-East", load: [1, 1, 1, 1, 0] },
  { name: "Scanner-EU-West", load: [1, 1, 0, 0, 0] },
  { name: "Analytic-Core", load: [1, 1, 1, 1, 1] },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-center mb-8">
        <Card className="bg-[var(--surface-mid)] border-[var(--gray-border)] p-1 pr-3 flex items-center gap-3 w-full max-w-2xl shadow-2xl">
          <Search className="w-5 h-5 text-[var(--accent)] ml-3" />
          <Input 
            placeholder="https://target-domain.io"
            className="bg-transparent border-none focus-visible:ring-0 text-sm font-mono w-full text-[var(--foreground)] placeholder:text-[var(--text-dim)]/30"
          />
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-[var(--text-dim)] px-2 py-1 bg-[var(--surface-dark)] border border-[var(--gray-border)] rounded">
              INTEL_DISCOVERY
            </span>
            <Button className="bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-[var(--primary-foreground)] text-[10px] font-bold px-4 py-2 rounded uppercase tracking-widest transition-all">
              Scan
            </Button>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-12 auto-rows-min gap-4">
        {stats.map((stat) => (
          <Card 
            key={stat.label}
            className="col-span-3 bg-[var(--surface-dark)] border-[var(--gray-border)] widget-outline p-4 relative min-h-[140px]"
          >
            <div className="flex flex-col h-full justify-between">
              <div>
                <span className="text-[10px] font-[var(--font-heading)] uppercase tracking-widest text-[var(--text-dim)] block mb-1">
                  {stat.label}
                </span>
                <h3 className="font-[var(--font-heading)] text-3xl font-bold data-value text-[var(--foreground)]">
                  {stat.value}
                </h3>
              </div>
              
              {stat.change && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[var(--accent)]">{stat.change}</span>
                  <div className="w-1/2 h-0.5 bg-[var(--gray-border)] relative overflow-hidden">
                    <div 
                      className="absolute inset-0 bg-[var(--accent)]" 
                      style={{ width: `${stat.progress}%` }}
                    />
                  </div>
                </div>
              )}
              
              {stat.bars && (
                <div className="flex gap-1 mt-2">
                  {stat.bars.map((width) => (
                    <div 
                      key={`${stat.label}-bar-${width}`}
                      className="h-1 flex-1 bg-[var(--accent)]" 
                      style={{ opacity: width / 100 }}
                    />
                  ))}
                </div>
              )}
              
              {stat.latest && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-[var(--text-dim)]">LATEST:</span>
                  <span className="text-[10px] font-mono text-[var(--accent)]">{stat.latest}</span>
                </div>
              )}
              
              {stat.status && (
                <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-dim)]">
                  <span>{stat.status}</span>
                  <span className="text-[var(--accent)]">{stat.uptime}</span>
                </div>
              )}
            </div>
          </Card>
        ))}

        <div className="col-span-9 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[var(--gray-border)] pb-2">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--accent)] flex items-center gap-2">
            <Activity className="w-4 h-4" />
            RECENT_SCAN_SEQUENCE
          </h2>
            <Link 
              href="/history"
              className="text-[10px] text-[var(--text-dim)] hover:text-[var(--accent)] font-[var(--font-heading)] uppercase transition-colors"
            >
              View_Logs
            </Link>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {recentScans.map((scan) => (
              <Card 
                key={scan.id}
                className={`bg-[var(--surface-mid)] widget-outline p-5 relative rounded-lg ${
                  scan.status === "analyzing" ? "border-[var(--accent)]/20" : ""
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-mono text-sm text-[var(--foreground)] font-bold">{scan.target}</h4>
                    <span className="text-[10px] font-mono text-[var(--text-dim)]">{scan.ip}</span>
                  </div>
                  {scan.status === "complete" && (
                    <Badge variant="outline" className="text-[9px] px-2 py-0.5 border-[var(--accent)]/40 text-[var(--accent)] rounded-full font-bold">
                      COMPLETE
                    </Badge>
                  )}
                  {scan.status === "analyzing" && (
                    <Badge className="text-[9px] px-2 py-0.5 bg-[var(--accent)] text-[var(--primary-foreground)] rounded-full font-bold flex items-center gap-1">
                      <span className="w-1 h-1 bg-[var(--primary-foreground)] rounded-full animate-ping" />
                      ANALYZING
                    </Badge>
                  )}
                  {scan.status === "failed" && (
                    <Badge variant="outline" className="text-[9px] px-2 py-0.5 border-red-500/40 text-red-400 rounded-full font-bold">
                      FAILED
                    </Badge>
                  )}
                </div>
                
                {scan.technologies ? (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {scan.technologies.map((tech) => (
                      <span 
                        key={tech}
                        className="text-[9px] px-2 py-1 bg-[var(--surface-light)] text-[var(--foreground)] border border-[var(--gray-border)] rounded"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="mb-6 h-9 flex items-center">
                    <span className="text-[10px] font-mono text-red-400 italic">{scan.error}</span>
                  </div>
                )}
                
                <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-dim)] border-t border-[var(--gray-border)] pt-3">
                  <span>{scan.timestamp}</span>
                  {scan.status === "complete" && (
                    <Link href={`/scans/${scan.id}`}>
                      <ExternalLink className="w-4 h-4 text-[var(--accent)]" />
                    </Link>
                  )}
                  {scan.status === "analyzing" && scan.progress && (
                    <div className="h-1 w-20 bg-[var(--gray-border)] rounded overflow-hidden">
                      <div 
                        className="h-full bg-[var(--accent)]" 
                        style={{ width: `${scan.progress}%` }}
                      />
                    </div>
                  )}
                  {scan.status === "failed" && (
                    <RefreshCw className="w-4 h-4 text-red-400" />
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className="col-span-3 space-y-4">
          <Card className="bg-[var(--surface-dark)] widget-outline p-4 relative min-h-[200px]">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-dim)] mb-4">
              SAVED_SHORTCUTS
            </h2>
            <div className="space-y-2">
              {savedShortcuts.map((shortcut) => (
                <Link 
                  key={shortcut.name}
                  href={`/search?q=${shortcut.name}`}
                  className="flex items-center justify-between p-2 bg-[var(--surface-mid)] border border-[var(--gray-border)] rounded hover:border-[var(--accent)] group cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Bookmark className="w-3 h-3 text-[var(--accent)]" />
                    <span className="text-[10px] font-mono text-[var(--foreground)]">{shortcut.name}</span>
                  </div>
                  <span className="text-[9px] text-[var(--text-dim)]">{shortcut.count}</span>
                </Link>
              ))}
            </div>
            <Button 
              variant="outline" 
              className="w-full mt-4 py-2 border-dashed border-[var(--gray-border)] text-[10px] text-[var(--text-dim)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all uppercase font-bold tracking-widest"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Bookmark
            </Button>
          </Card>

          <Card className="bg-[var(--surface-dark)] widget-outline p-4 relative">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-dim)] mb-4">
              SYSTEM_NODES
            </h2>
            <div className="space-y-3">
              {systemNodes.map((node) => (
                <div key={node.name} className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[var(--text-dim)]">{node.name}</span>
                  <div className="flex gap-0.5">
                    {node.load.map((active) => (
                      <div 
                        key={`${node.name}-${active}`}
                        className={`w-1 h-3 ${active ? "bg-[var(--accent)]" : "bg-[var(--gray-border)]"}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
