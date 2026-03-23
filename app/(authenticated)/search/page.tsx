import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Search,
  Filter,
  Globe,
  Server,
  Code,
  Blocks,
  Calendar,
  ExternalLink
} from "lucide-react"

const searchResults = [
  {
    id: "result-001",
    target: "payments.example.test",
    title: "Stripe | Payment Processing Platform for the Internet",
    technologies: ["React", "Go", "Node.js", "AWS", "Cloudflare"],
    server: "nginx",
    cdn: "Cloudflare",
    lastScanned: "2024-05-21 14:02",
    statusCode: 200,
  },
  {
    id: "result-002",
    target: "github.com",
    title: "GitHub: Let's build from here",
    technologies: ["Ruby", "MySQL", "Redis", "Elasticsearch"],
    server: "GitHub.com",
    cdn: "Fastly",
    lastScanned: "2024-05-21 13:58",
    statusCode: 200,
  },
  {
    id: "result-003",
    target: "app.example.test",
    title: "Vercel: Build and deploy the best web experiences",
    technologies: ["Next.js", "React", "Vercel"],
    server: "Vercel",
    cdn: "Vercel Edge",
    lastScanned: "2024-05-21 12:44",
    statusCode: 200,
  },
  {
    id: "result-004",
    target: "cms.example.test",
    title: "Blog Tool, Publishing Platform, and CMS",
    technologies: ["WordPress", "PHP", "MySQL"],
    server: "nginx",
    cdn: null,
    wordpressPlugins: ["Jetpack", "Akismet", "Yoast SEO"],
    lastScanned: "2024-05-20 09:15",
    statusCode: 200,
  },
]

const filters = [
  { label: "Technology", icon: Code },
  { label: "CDN", icon: Globe },
  { label: "Server", icon: Server },
  { label: "WordPress", icon: Blocks },
  { label: "Date Range", icon: Calendar },
]

export default function SearchPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-[var(--accent)]" />
          <h1 className="font-[var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
            Cross-Scan Search
          </h1>
        </div>
        <Button variant="outline" size="sm" className="border-[var(--gray-border)] text-[var(--text-dim)]">
          <Filter className="w-4 h-4 mr-2" />
          Advanced
        </Button>
      </div>

      <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]">
        <CardHeader className="pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--accent)]" />
            <Input 
              placeholder="Search across all scan results..."
              className="pl-12 py-6 text-lg bg-[var(--surface-mid)] border-[var(--gray-border)] text-[var(--foreground)] placeholder:text-[var(--text-dim)]/50"
            />
          </div>
          <div className="flex items-center gap-2 mt-4">
            {filters.map((filter) => (
              <Button 
                key={filter.label}
                variant="outline" 
                size="sm"
                className="border-[var(--gray-border)] text-[var(--text-dim)] hover:text-[var(--accent)] hover:border-[var(--accent)]"
              >
                <filter.icon className="w-3 h-3 mr-2" />
                {filter.label}
              </Button>
            ))}
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-3">
        {searchResults.map((result) => (
          <Card 
            key={result.id}
            className="bg-[var(--surface-mid)] border-[var(--gray-border)] widget-outline hover:border-[var(--accent)]/40 transition-colors"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-mono text-sm text-[var(--foreground)] font-bold">
                      {result.target}
                    </h3>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-green-500/40 text-green-400">
                      {result.statusCode}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--text-dim)]">
                    {result.title}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--text-dim)] hover:text-[var(--accent)]">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {result.technologies.map((tech) => (
                  <span 
                    key={tech}
                    className="text-[9px] px-2 py-1 bg-[var(--surface-light)] text-[var(--foreground)] border border-[var(--gray-border)] rounded"
                  >
                    {tech}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-dim)] border-t border-[var(--gray-border)] pt-3">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <Server className="w-3 h-3" />
                    {result.server}
                  </span>
                  {result.cdn && (
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {result.cdn}
                    </span>
                  )}
                  {result.wordpressPlugins && (
                    <span className="flex items-center gap-1">
                      <Blocks className="w-3 h-3" />
                      {result.wordpressPlugins.length} plugins
                    </span>
                  )}
                </div>
                <span>Last scanned: {result.lastScanned}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
