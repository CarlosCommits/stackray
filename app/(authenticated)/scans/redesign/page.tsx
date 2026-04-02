"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  CheckCircle2, 
  Clock, 
  Globe, 
  Scan, 
  Server, 
  Shield, 
  ArrowLeftRight, 
  MapPin,
  Layers,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  AlertTriangle,
  Info,
  Bug,
  Fingerprint,
  Database,
  Network,
  Lock,
  Globe2,
  FileText,
  Mail,
  Phone,
  Calendar,
  Clock3,
  ShieldCheck,
  Hash,
  Link2,
  Wifi,
  Eye,
  Cpu,
  CalendarDays,
  History,
  ExternalLink as LinkIcon,
  RefreshCw,
  Star,
  Puzzle,
  Plus
} from "lucide-react"

// Sample scan data for the redesign prototype
const sampleScanData = {
  scanId: "78da375f-d5f8-4e9f-9c62-66802b9a3fa5",
  target: "path-target.example.test",
  finalUrl: "https://www.path-target.example.test/",
  status: "completed",
  source: "api",
  submittedAt: "2026-03-29T18:28:00Z",
  completedAt: "2026-03-29T18:30:00Z",
  statusCode: 200,
  statusText: "OK",
  redirectCount: 1,
  server: "nginx",
  cdnName: "Varnish, Pantheon",
  hostIp: "23.185.0.253",
  asnOrg: "Fastly",
  asnNumber: "AS54113",
  responseTimeMs: 562,
  contentType: "text/html",
  contentLength: 178511,
  title: "Sample Industry Association",
  technologies: {
    primary: ["Nginx", "PHP", "WordPress", "WordPress Block Editor", "jQuery"],
    additional: ["CookieYes", "Fastly", "Google Analytics", "Google Tag Manager", "HSTS", "MariaDB", "MySQL", "Pantheon", "Performance Lab", "Slick", "Varnish", "theTradeDesk"],
    wordpress: ["Yoast SEO Premium", "Yoast SEO", "jQuery Migrate"]
  },
  nucleiTechnologies: [
    { name: "nginx", matchedAt: "https://www.path-target.example.test/" },
    { name: "appnexus", matchedAt: "https://www.path-target.example.test/" },
    { name: "google-tag-manager", matchedAt: "https://www.path-target.example.test/" },
    { name: "google-font-api", matchedAt: "https://www.path-target.example.test/" }
  ],
  redirectChain: [
    { url: "https://path-target.example.test", statusCode: 301, location: "https://www.path-target.example.test/" },
    { url: "https://www.path-target.example.test/", statusCode: 200 }
  ],
  tls: {
    sni: "www.path-target.example.test",
    issuer: "Let's Encrypt",
    serial: "06:90:0D:05:39:64:B6:F9:55:76:8C:EC:5F:65:57:83:9E:C4",
    notAfter: "2026-05-23",
    notBefore: "2026-02-22",
    tlsVersion: "TLS 1.3",
    cipher: "TLS_AES_128_GCM_SHA256",
    subjectAn: ["path-target.example.test", "www.path-target.example.test"]
  },
  dns: {
    a: ["23.185.0.253"],
    aaaa: ["2620:12a:8000::253", "2620:12a:8001::253"],
    cname: [],
    resolvers: ["1.1.1.1:53", "1.0.0.1:53"]
  },
  favicon: {
    mmh3: "-1830687435",
    md5: "c4a5b58b9454b49b47a9ce9d1ca02b05",
    url: "https://www.path-target.example.test/wp-content/uploads/2024/02/sample-favicon-150x150.png"
  },
  jarmHash: "3fd3fd0003fd3fd00041d41d00041d6b5eefa2404a56c2ced79a0d16afe36c",
  bodyDomains: [
    "media-a.example.test", "media-b.example.test", "schema.example.test", "social-a.example.test", "ads-a.example.test",
    "cms.example.test", "games-a.example.test", "social-b.example.test", "ads-b.example.test", "games-b.example.test",
    "advocacy.example.test", "publisher.example.test", "seo.example.test", "ads-c.example.test", "games-c.example.test",
    "games-d.example.test", "games-e.example.test", "console-a.example.test", "games-f.example.test", "social-c.example.test",
    "static-a.example.test", "tags.example.test", "console-b.example.test", "games-g.example.test", "games-h.example.test",
    "games-i.example.test", "games-j.example.test", "games-k.example.test", "games-l.example.test", "fonts.example.test",
    "social-d.example.test", "schema.example.org", "publisher-b.example.test", "consent.example.test", "media-c.example.test", "social-e.example.test",
    "standards.example.test", "games-m.example.test", "netflisocial-e.example.test"
  ],
  bodyFqdns: [
    "www.games-b.example.test", "www.games-a.example.test", "fonts.static.example.test", "www.games-c.example.test",
    "about.games-h.example.test", "www.console-b.example.test", "corp.games-j.example.test", "www.social-d.example.test", "acdn.ads-c.example.test",
    "ad.ads-b.example.test", "insight.ads-a.example.test", "www.media-b.example.test", "www.social-a.example.test",
    "www.publisher-b.example.test", "www.games-i.example.test", "www.standards.example.test", "www.games-m.example.test", "games.media-c.example.test",
    "www.tags.example.test", "ib.ads-c.example.test", "www.games-e.example.test", "www.netflisocial-e.example.test",
    "www.games-k.example.test", "www.media-a.example.test", "www.games-g.example.test", "www.social-c.example.test",
    "www.path-target.example.test", "www.games-d.example.test", "www.games-f.example.test", "www.publisher.example.test"
  ],
  hashes: {
    bodyMd5: "6b43423913d844d49c8b256841c82bf4",
    bodyMmh3: "697627490",
    bodySha256: "5aacf1ba20633c53a39b66b8e96167817a0d7351f4bafb784e36c882e56d950f",
    headerMd5: "39d7b6dbe6d135bb66849b42c455a674",
    headerMmh3: "-1181033080",
    headerSha256: "ba23202d47574483c34725b148d89617762c9868ab8300c5db8679c9c558523f"
  },
  cpeEntries: [
    { cpe: "cpe:2.3:a:nginx:nginx:1.24.0:*:*:*:*:*:*:*", vendor: "nginx", product: "nginx" },
    { cpe: "cpe:2.3:a:php:php:*:*:*:*:*:*:*:*", vendor: "PHP", product: "PHP" },
    { cpe: "cpe:2.3:a:wordpress:wordpress:*:*:*:*:*:*:*:*", vendor: "WordPress", product: "WordPress" },
    { cpe: "cpe:2.3:a:jquery:jquery:*:*:*:*:*:*:*:*", vendor: "jQuery", product: "jQuery" },
    { cpe: "cpe:2.3:a:mariadb:mariadb:*:*:*:*:*:*:*:*", vendor: "MariaDB", product: "MariaDB" },
  ]
}

// Findings from nuclei scan
const findings = {
  security: [
    { category: "Domain Metadata", count: 11, items: [
      { label: "Name Servers", value: "NS1.EXAMPLE.TEST, NS2.EXAMPLE.TEST" },
      { label: "Registrar", value: "Example Registrar, LLC" },
      { label: "Registrar Email", value: "domain.operations@example.test" },
      { label: "Registrar Phone", value: "+1.8777228662" },
      { label: "Registrar URL", value: "https://registrar.example.test" },
      { label: "Registration Date", value: "2002-11-21" },
      { label: "Last Changed", value: "2023-09-22" },
      { label: "Expiration Date", value: "2028-11-21" },
      { label: "DNSSEC", value: "false" },
      { label: "Status", value: "client transfer prohibited" },
      { label: "Registrar IANA ID", value: "2" },
    ]},
    { category: "DNS Services", count: 3, items: [
      { label: "Apple", value: "Detected" },
      { label: "Google Workspace", value: "Detected" },
      { label: "OpenAI", value: "Detected" },
    ]},
    { category: "SSL DNS Names", count: 1, items: [
      { label: "Subject Alternative Names", value: "path-target.example.test, www.path-target.example.test" }
    ]},
    { category: "SSL Issuer", count: 1, items: [
      { label: "Certificate Issuer", value: "Let's Encrypt" }
    ]},
    { category: "TXT Records", count: 1, items: [
      { label: "SPF, Google, Apple, OpenAI", value: "5 TXT records found" }
    ]},
    { category: "Robots.txt", count: 1, items: [
      { label: "Robots.txt", value: "Exists" }
    ]}
  ],
  total: 18
}

const sampleHistory = [
  { scanId: "78da375f-d5f8-4e9f-9c62-66802b9a3fa5", date: "2026-03-29 6:28 PM", status: "completed", technologies: 22, issues: 18, finalUrl: "https://www.path-target.example.test/" },
  { scanId: "62cf1a2b-3c4d-5e6f-7a8b-9c0d1e2f3a4b", date: "2026-03-25 2:15 PM", status: "completed", technologies: 20, issues: 15, finalUrl: "https://www.path-target.example.test/" },
  { scanId: "51be9123-2b3c-4d5e-6f7a-8b9c0d1e2f3a4", date: "2026-03-20 9:45 AM", status: "failed", technologies: 0, issues: 0, finalUrl: "N/A" },
  { scanId: "4fad8012-1a2b-3c4d-5e6f-7a8b9c0d1e2f", date: "2026-03-15 11:30 AM", status: "completed", technologies: 19, issues: 12, finalUrl: "https://www.path-target.example.test/" },
]

const txtRecords = [
  "apple-domain-verification=FJ4OyJ44zzaZLTGl",
  "google-site-verification=YuHmKjwz6W3dhRYMvEBVaW_67FUC6EmM_UUNVQBPdss",
  "openai-domain-verification=dv-YTMGizkvMBo1mBFkQMnBnAiW",
  "v=spf1 mx a ip4:64.190.48.74 ip4:96.86.20.225 include:mail-a.example.test include:mail-b.example.test include:mail-c.example.test -all",
  "6e618vmkm9qfk2ga76chs8lfvm"
]

const domainMetadata = {
  nameServers: ["NS1.EXAMPLE.TEST", "NS2.EXAMPLE.TEST"],
  registrar: "Example Registrar, LLC",
  registrarEmail: "domain.operations@example.test",
  registrarPhone: "+1.8777228662",
  registrarUrl: "https://registrar.example.test",
  registrarIanaId: "2",
  registrationDate: "2002-11-21",
  lastChanged: "2023-09-22",
  expirationDate: "2028-11-21",
  dnssec: false,
  status: "client transfer prohibited"
}

function CompactKPI({ icon: Icon, label, value, subValue, color = "accent" }: { 
  icon: React.ElementType
  label: string
  value: string | number
  subValue?: string
  color?: "accent" | "emerald" | "amber" | "orange" | "red"
}) {
  const colorClasses = {
    accent: "text-[var(--accent)]",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    orange: "text-orange-400",
    red: "text-red-400",
  }
  
  return (
    <div className="bg-[var(--surface-dark)] border border-[var(--gray-border)]/20 rounded-lg p-4 hover:border-[var(--accent)]/30 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-5 h-5 ${colorClasses[color]}`} />
        <span className="text-sm uppercase tracking-wider text-[var(--muted-foreground)]">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</p>
      {subValue && <p className="text-sm text-[var(--muted-foreground)] mt-1">{subValue}</p>}
    </div>
  )
}

function CollapsibleSection({ 
  title, 
  icon: Icon, 
  children, 
  defaultOpen = false,
  badge 
}: { 
  title: string
  icon: React.ElementType
  children: React.ReactNode
  defaultOpen?: boolean
  badge?: string | number
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  
  return (
    <div className="border border-[var(--gray-border)]/30 rounded-lg overflow-hidden bg-[var(--surface-dark)]">
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-[var(--surface-dark)] hover:bg-[var(--surface-mid)]/20 transition-colors border-b border-transparent data-[state=open]:border-[var(--gray-border)]/20"
        data-state={isOpen ? "open" : "closed"}
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-[var(--accent)]" />
          <span className="font-semibold text-lg">{title}</span>
          {badge && (
            <Badge variant="outline" className="text-sm ml-2">{badge}</Badge>
          )}
        </div>
        {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </button>
      {isOpen && <div className="p-5 space-y-5 bg-[var(--background)]">{children}</div>}
    </div>
  )
}

function ViewToggle({ mode, onChange }: { mode: "compact" | "spacious", onChange: (m: "compact" | "spacious") => void }) {
  return (
    <div className="flex items-center gap-2 p-1 bg-[var(--surface-dark)] border border-[var(--gray-border)]/20 rounded-lg">
      <button
        type="button"
        onClick={() => onChange("compact")}
        className={`px-4 py-2 text-sm rounded-md transition-colors ${
          mode === "compact" 
            ? "bg-[var(--accent)] text-white" 
            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        }`}
      >
        Compact
      </button>
      <button
        type="button"
        onClick={() => onChange("spacious")}
        className={`px-4 py-2 text-sm rounded-md transition-colors ${
          mode === "spacious" 
            ? "bg-[var(--accent)] text-white" 
            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        }`}
      >
        Spacious
      </button>
    </div>
  )
}

function LayoutToggle({ mode, onChange }: { mode: "dashboard" | "stacked", onChange: (m: "dashboard" | "stacked") => void }) {
  return (
    <div className="flex items-center gap-2 p-1 bg-[var(--surface-dark)] border border-[var(--gray-border)]/20 rounded-lg">
      <button
        type="button"
        onClick={() => onChange("dashboard")}
        className={`px-4 py-2 text-sm rounded-md transition-colors ${
          mode === "dashboard" 
            ? "bg-[var(--accent)] text-white" 
            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        }`}
      >
        Dashboard
      </button>
      <button
        type="button"
        onClick={() => onChange("stacked")}
        className={`px-4 py-2 text-sm rounded-md transition-colors ${
          mode === "stacked" 
            ? "bg-[var(--accent)] text-white" 
            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        }`}
      >
        Stacked
      </button>
    </div>
  )
}

export default function ScanRedesignPage() {
  const [viewMode, setViewMode] = useState<"compact" | "spacious">("compact")
  const [layoutMode, setLayoutMode] = useState<"dashboard" | "stacked">("dashboard")
  const [techExpanded, setTechExpanded] = useState(false)
  const [domainViewAll, setDomainViewAll] = useState(false)
  
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }
  
  const spacingClass = viewMode === "compact" ? "gap-3" : "gap-6"
  const paddingClass = viewMode === "compact" ? "p-3" : "p-5"
  
  const totalTechCount = sampleScanData.technologies.primary.length + sampleScanData.technologies.additional.length + sampleScanData.technologies.wordpress.length
  const primaryCount = sampleScanData.technologies.primary.length
  const additionalCount = sampleScanData.technologies.additional.length
  const wordpressCount = sampleScanData.technologies.wordpress.length

  return (
    <div className="min-h-screen bg-[var(--background)] p-4 md:p-6">
      <div className={`max-w-7xl mx-auto ${layoutMode === "dashboard" ? "grid grid-cols-1 lg:grid-cols-3" : "flex flex-col"}`}>
        
        <div className={layoutMode === "dashboard" ? "lg:col-span-2 space-y-4" : "space-y-4"}>
          
          {/* Header Card */}
          <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20">
            <CardContent className={paddingClass}>
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex-1">
                  <h1 className="text-4xl font-bold tracking-tight">{sampleScanData.target}</h1>
                  <div className="flex items-center gap-3 mt-2 text-sm text-[var(--muted-foreground)]">
                    <CalendarDays className="w-4 h-4" />
                    <span>Submitted {new Date(sampleScanData.submittedAt).toLocaleString("en-US", { 
                      month: "short", 
                      day: "numeric", 
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true
                    })}</span>
                    <span className="text-[var(--gray-border)]">|</span>
                    <span className="font-mono text-xs">{sampleScanData.scanId.slice(0, 8)}...</span>
                  </div>
                </div>
                <div className="flex flex-col items-start md:items-end gap-2">
                  <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold uppercase tracking-wider text-sm">
                      {sampleScanData.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-[var(--muted-foreground)]">
                    <Clock className="w-4 h-4" />
                    ~2 min scan
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Metrics Row */}
          <div className={`grid grid-cols-2 md:grid-cols-4 ${spacingClass}`}>
            <CompactKPI 
              icon={Shield} 
              label="Status" 
              value={sampleScanData.statusCode} 
              subValue={sampleScanData.statusText}
              color="emerald"
            />
            <CompactKPI 
              icon={ArrowLeftRight} 
              label="Redirects" 
              value={sampleScanData.redirectCount} 
              subValue={sampleScanData.redirectCount === 1 ? "1 hop" : `${sampleScanData.redirectCount} hops`}
            />
            <CompactKPI 
              icon={Server} 
              label="Server" 
              value={sampleScanData.server} 
              subValue={sampleScanData.cdnName}
            />
            <CompactKPI 
              icon={MapPin} 
              label="Host IP" 
              value={sampleScanData.hostIp} 
              subValue={sampleScanData.asnOrg}
            />
          </div>

          {/* Page Title & Final URL */}
          <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20">
            <CardContent className={paddingClass}>
              <div>
                <p className="text-sm uppercase tracking-wider text-[var(--muted-foreground)] mb-2">Page Title</p>
                <p className="text-xl font-medium">{sampleScanData.title}</p>
              </div>
            </CardContent>
          </Card>

          {/* Technologies */}
          <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20">
            <CardContent className={paddingClass}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[var(--accent)]" />
                  <span className="font-semibold text-lg">Technologies</span>
                  <Badge variant="outline" className="ml-1">{totalTechCount}</Badge>
                </div>
                <button 
                  type="button"
                  onClick={() => setTechExpanded(!techExpanded)}
                  className="text-sm text-[var(--accent)] hover:underline"
                >
                  {techExpanded ? "Collapse" : "Expand all"}
                </button>
              </div>
              
              {/* Primary Technologies */}
              <div className="mb-6 bg-[var(--accent)]/5 border border-[var(--accent)]/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-[var(--accent)]/20 rounded-lg">
                    <Star className="w-4 h-4 text-[var(--accent)]" />
                  </div>
                  <span className="text-sm font-semibold text-[var(--foreground)]">Primary Stack</span>
                  <Badge variant="outline" className="text-xs border-[var(--accent)]/30">{primaryCount}</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                  {sampleScanData.technologies.primary.map((tech) => (
                    <div 
                      key={tech}
                      className="flex items-center gap-2 px-3 py-2.5 bg-[var(--surface-dark)] border border-[var(--accent)]/20 rounded-lg hover:border-[var(--accent)]/50 hover:shadow-sm transition-all cursor-default"
                    >
                      <div className="w-2 h-2 rounded-full bg-[var(--accent)] shadow-[0_0_6px_rgba(0,0,0,0.3)]" />
                      <span className="text-sm font-medium text-[var(--foreground)] truncate">{tech}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* WordPress Plugins */}
              {wordpressCount > 0 && (
                <div className="mb-6 bg-[var(--surface-mid)]/20 border border-[var(--gray-border)]/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-purple-500/20 rounded-lg">
                      <Puzzle className="w-4 h-4 text-purple-400" />
                    </div>
                    <span className="text-sm font-semibold text-[var(--foreground)]">WordPress Plugins</span>
                    <Badge variant="outline" className="text-xs">{wordpressCount}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sampleScanData.technologies.wordpress.map((tech) => (
                      <div 
                        key={tech}
                        className="flex items-center gap-2 px-3 py-2 bg-[var(--surface-dark)] border border-[var(--gray-border)]/50 rounded-lg hover:border-purple-400/50 hover:shadow-sm transition-all cursor-default"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                        <span className="text-sm text-[var(--foreground)] truncate">{tech}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {sampleScanData.cpeEntries && sampleScanData.cpeEntries.length > 0 && (
                <div className="bg-[var(--surface-mid)]/10 border border-[var(--gray-border)]/10 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-[var(--accent)]/20 rounded-lg">
                      <Shield className="w-4 h-4 text-[var(--accent)]" />
                    </div>
                    <span className="text-sm font-semibold text-[var(--foreground)]">CPE Entries</span>
                    <Badge variant="outline" className="text-xs">{sampleScanData.cpeEntries.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {sampleScanData.cpeEntries.map((entry) => (
                      <div 
                        key={entry.cpe}
                        className="flex flex-col gap-1 px-3 py-2 bg-[var(--surface-dark)] border border-[var(--gray-border)]/30 rounded-lg"
                      >
                        <span className="text-sm font-medium text-[var(--foreground)]">
                          {entry.vendor} {entry.product}
                        </span>
                        <code className="text-xs text-[var(--muted-foreground)] font-mono break-all">{entry.cpe}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Technologies */}
              <div className="bg-[var(--surface-mid)]/10 border border-[var(--gray-border)]/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-[var(--muted-foreground)]/20 rounded-lg">
                    <Plus className="w-4 h-4 text-[var(--muted-foreground)]" />
                  </div>
                  <span className="text-sm font-semibold text-[var(--foreground)]">Additional Detected</span>
                  <Badge variant="outline" className="text-xs">{additionalCount}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(techExpanded ? sampleScanData.technologies.additional : sampleScanData.technologies.additional.slice(0, 12)).map((tech) => (
                    <div 
                      key={tech}
                      className="flex items-center gap-2 px-3 py-2 bg-[var(--surface-dark)] border border-[var(--gray-border)]/30 rounded-lg hover:border-[var(--accent)]/30 hover:shadow-sm transition-all cursor-default"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--muted-foreground)]" />
                      <span className="text-sm text-[var(--muted-foreground)] truncate">{tech}</span>
                    </div>
                  ))}
                  {!techExpanded && additionalCount > 12 && (
                    <button 
                      type="button"
                      onClick={() => setTechExpanded(true)}
                      className="flex items-center gap-2 px-3 py-2 bg-[var(--surface-dark)] border border-dashed border-[var(--accent)]/40 rounded-lg hover:border-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all"
                    >
                      <Plus className="w-3 h-3 text-[var(--accent)]" />
                      <span className="text-sm text-[var(--accent)] font-medium">+{additionalCount - 12} more</span>
                    </button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Technical Details - Collapsible */}
          <div id="section-technical-details">
          <CollapsibleSection 
            title="Technical Details" 
            icon={Database}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 text-base">
              <div>
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Response Time</p>
                <p className="font-mono">{sampleScanData.responseTimeMs}ms</p>
              </div>
              <div>
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Content Type</p>
                <p className="font-mono">{sampleScanData.contentType}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Content Length</p>
                <p className="font-mono">{sampleScanData.contentLength.toLocaleString()} bytes</p>
              </div>
              <div>
                <p className="text-sm text-[var(--muted-foreground)] mb-1">HTTP/2</p>
                <p className="font-mono text-emerald-400">✓ Enabled</p>
              </div>
            </div>
          </CollapsibleSection>
          </div>

          {/* Infrastructure - Collapsible */}
          <div id="section-infrastructure">
          <CollapsibleSection 
            title="DNS & Infrastructure" 
            icon={Network}
          >
            <div className="space-y-5">
              <div>
                <p className="text-sm text-[var(--muted-foreground)] mb-3">DNS Records</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-base">
                  <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                    <p className="text-sm text-[var(--muted-foreground)] mb-1">A Record</p>
                    <p className="font-mono text-sm">{sampleScanData.dns.a.join(", ")}</p>
                  </div>
                  <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                    <p className="text-sm text-[var(--muted-foreground)] mb-1">AAAA Records</p>
                    <p className="font-mono text-sm">{sampleScanData.dns.aaaa.join(", ")}</p>
                  </div>
                  <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                    <p className="text-sm text-[var(--muted-foreground)] mb-1">Resolvers</p>
                    <p className="font-mono text-sm">{sampleScanData.dns.resolvers.join(", ")}</p>
                  </div>
                </div>
              </div>
              <div className="border-t border-[var(--gray-border)]/20 pt-5">
                <p className="text-sm text-[var(--muted-foreground)] mb-3">Name Servers</p>
                <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                  <p className="font-mono text-sm">{domainMetadata.nameServers.join(", ")}</p>
                </div>
              </div>
              <div className="border-t border-[var(--gray-border)]/20 pt-5">
                <p className="text-sm text-[var(--muted-foreground)] mb-3">TXT Records</p>
                <div className="space-y-2">
                  {txtRecords.map((record) => (
                    <div key={record.slice(0, 30)} className="p-3 bg-[var(--surface-mid)]/20 rounded font-mono text-sm break-all">
                      {record}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CollapsibleSection>
          </div>

          {/* TLS Certificate - Collapsible */}
          <div id="section-tls">
          <CollapsibleSection 
            title="TLS Certificate" 
            icon={Lock}
            defaultOpen={true}
          >
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-base">
              <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Issuer</p>
                <p className="font-mono text-sm">{sampleScanData.tls.issuer}</p>
              </div>
              <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Serial</p>
                <p className="font-mono text-xs break-all">06:90:0D:05:39:64:B6:F9:55:76:8C:EC:5F:65:57:83:9E:C4</p>
              </div>
              <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                <p className="text-sm text-[var(--muted-foreground)] mb-1">TLS Version</p>
                <p className="font-mono text-sm">{sampleScanData.tls.tlsVersion}</p>
              </div>
              <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Cipher</p>
                <p className="font-mono text-xs break-all">{sampleScanData.tls.cipher}</p>
              </div>
              <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Expires</p>
                <p className="font-mono text-sm">{sampleScanData.tls.notAfter}</p>
              </div>
            </div>
          </CollapsibleSection>
          </div>

          {/* Fingerprints - Collapsible */}
          <div id="section-fingerprints">
          <CollapsibleSection 
            title="Fingerprints" 
            icon={Fingerprint}
          >
            <div className="grid grid-cols-2 gap-4 text-base">
              <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                <p className="text-sm text-[var(--muted-foreground)] mb-1">JARM Hash</p>
                <p className="font-mono text-sm break-all">{sampleScanData.jarmHash}</p>
              </div>
              <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Body MD5</p>
                <p className="font-mono text-sm">{sampleScanData.hashes.bodyMd5}</p>
              </div>
              <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Body MMH3</p>
                <p className="font-mono text-sm">{sampleScanData.hashes.bodyMmh3}</p>
              </div>
              <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Body SHA256</p>
                <p className="font-mono text-sm break-all">{sampleScanData.hashes.bodySha256.slice(0, 32)}...</p>
              </div>
              <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Header MD5</p>
                <p className="font-mono text-sm">{sampleScanData.hashes.headerMd5}</p>
              </div>
              <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Header MMH3</p>
                <p className="font-mono text-sm">{sampleScanData.hashes.headerMmh3}</p>
              </div>
              <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg col-span-2">
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Header SHA256</p>
                <p className="font-mono text-sm break-all">{sampleScanData.hashes.headerSha256}</p>
              </div>
            </div>
          </CollapsibleSection>
          </div>

          {/* Favicon - Collapsible */}
          <div id="section-favicon">
          <CollapsibleSection 
            title="Favicon" 
            icon={Eye}
            defaultOpen={true}
          >
            <div className="space-y-4">
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 bg-[var(--surface-mid)] rounded-lg flex items-center justify-center overflow-hidden">
                  <img 
                    src={sampleScanData.favicon.url} 
                    alt="Favicon" 
                    className="w-14 h-14 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-[var(--muted-foreground)] mb-2">Favicon URL</p>
                  <p className="font-mono text-sm break-all">{sampleScanData.favicon.url}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-base">
                <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                  <p className="text-sm text-[var(--muted-foreground)] mb-1">MMH3 Hash</p>
                  <p className="font-mono">{sampleScanData.favicon.mmh3}</p>
                </div>
                <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                  <p className="text-sm text-[var(--muted-foreground)] mb-1">MD5 Hash</p>
                  <p className="font-mono">{sampleScanData.favicon.md5}</p>
                </div>
              </div>
            </div>
          </CollapsibleSection>
          </div>

          {/* Domain Info - Collapsible */}
          <div id="section-domain-info">
          <CollapsibleSection 
            title="Domain Info" 
            icon={FileText}
            defaultOpen={true}
          >
            <div className="grid grid-cols-2 gap-4 text-base">
              <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Registrar</p>
                <p className="font-medium">{domainMetadata.registrar}</p>
              </div>
              <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Registrar IANA ID</p>
                <p className="font-mono">{domainMetadata.registrarIanaId}</p>
              </div>
              <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Registrar Email</p>
                <p className="font-mono text-sm">{domainMetadata.registrarEmail}</p>
              </div>
              <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Registrar Phone</p>
                <p className="font-mono">{domainMetadata.registrarPhone}</p>
              </div>
              <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Registrar URL</p>
                <a href={domainMetadata.registrarUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline text-sm">
                  {domainMetadata.registrarUrl}
                </a>
              </div>
              <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                <p className="text-sm text-[var(--muted-foreground)] mb-1">DNSSEC</p>
                <p className={domainMetadata.dnssec ? "text-emerald-400" : "text-orange-400"}>
                  {domainMetadata.dnssec ? "Enabled" : "Disabled"}
                </p>
              </div>
              <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Status</p>
                <p className="text-sm">{domainMetadata.status}</p>
              </div>
              <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Registration Date</p>
                <p className="font-mono text-sm">{domainMetadata.registrationDate}</p>
              </div>
              <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Last Changed</p>
                <p className="font-mono text-sm">{domainMetadata.lastChanged}</p>
              </div>
              <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Expiration Date</p>
                <p className="font-mono text-sm">{domainMetadata.expirationDate}</p>
              </div>
            </div>
          </CollapsibleSection>
          </div>

          {/* Robots.txt - Collapsible */}
          <div id="section-robots-txt">
          <CollapsibleSection 
            title="Robots.txt" 
            icon={FileText}
          >
            <div className="p-4 bg-[var(--surface-mid)]/20 rounded font-mono text-sm">
              <p className="text-emerald-400 mb-3">✓ Robots.txt found</p>
              <p className="text-[var(--muted-foreground)] mb-1">User-agent: *</p>
              <p className="text-[var(--muted-foreground)] mb-1">Disallow: /wp-admin/</p>
              <p className="text-[var(--muted-foreground)] mb-1">Allow: /wp-admin/admin-ajax.php</p>
              <p className="text-[var(--muted-foreground)]">Sitemap: https://www.path-target.example.test/wp-sitemap.xml</p>
            </div>
          </CollapsibleSection>
          </div>

        </div>

        {/* Sidebar */}
        {layoutMode === "dashboard" && (
          <div className="space-y-4 lg:pl-4 mt-4 lg:mt-0">
            
            {/* Quick Actions */}
            <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20">
              <CardContent className={paddingClass}>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    className="group flex flex-col items-center gap-2 py-3 px-2 rounded-lg border border-[var(--gray-border)]/40 bg-[var(--surface-mid)]/10 hover:border-[var(--accent)]/60 hover:bg-[var(--accent)]/8 transition-all duration-150 cursor-pointer"
                  >
                    <div className="p-1.5 rounded-md bg-[var(--accent)]/10 group-hover:bg-[var(--accent)]/20 transition-colors">
                      <RefreshCw className="w-3.5 h-3.5 text-[var(--accent)]" />
                    </div>
                    <span className="text-xs font-medium text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] transition-colors">Rescan</span>
                  </button>
                  <button
                    type="button"
                    className="group flex flex-col items-center gap-2 py-3 px-2 rounded-lg border border-[var(--gray-border)]/40 bg-[var(--surface-mid)]/10 hover:border-[var(--accent)]/60 hover:bg-[var(--accent)]/8 transition-all duration-150 cursor-pointer"
                  >
                    <div className="p-1.5 rounded-md bg-[var(--accent)]/10 group-hover:bg-[var(--accent)]/20 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5 text-[var(--accent)]" />
                    </div>
                    <span className="text-xs font-medium text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] transition-colors">Open Site</span>
                  </button>
                  <button
                    type="button"
                    className="group flex flex-col items-center gap-2 py-3 px-2 rounded-lg border border-[var(--gray-border)]/40 bg-[var(--surface-mid)]/10 hover:border-[var(--accent)]/60 hover:bg-[var(--accent)]/8 transition-all duration-150 cursor-pointer"
                  >
                    <div className="p-1.5 rounded-md bg-[var(--accent)]/10 group-hover:bg-[var(--accent)]/20 transition-colors">
                      <Fingerprint className="w-3.5 h-3.5 text-[var(--accent)]" />
                    </div>
                    <span className="text-xs font-medium text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] transition-colors">Raw Data</span>
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Screenshot Preview */}
            <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20">
              <CardContent className={paddingClass}>
                <div className="flex items-center gap-2 mb-4">
                  <Eye className="w-5 h-5 text-[var(--accent)]" />
                  <span className="font-semibold text-base">Homepage Screenshot</span>
                </div>
                <div className="bg-[var(--surface-mid)] rounded-lg overflow-hidden border border-[var(--gray-border)]/20">
                  <div className="h-56 bg-gradient-to-br from-[var(--surface-mid)] to-[var(--surface-dark)] flex items-center justify-center">
                    <div className="text-center">
                      <Globe className="w-16 h-16 text-[var(--muted-foreground)] mx-auto mb-3" />
                      <p className="text-base text-[var(--muted-foreground)]">Screenshot preview</p>
                      <p className="text-sm text-[var(--muted-foreground)]">{sampleScanData.contentLength.toLocaleString()} bytes</p>
                    </div>
                  </div>
                  <div className="p-3 border-t border-[var(--gray-border)]/20">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--muted-foreground)] ml-auto">{Math.round(sampleScanData.contentLength / 1024)} KB</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Redirect Chain */}
            <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20">
              <CardContent className={paddingClass}>
                <div className="flex items-center gap-2 mb-4">
                  <LinkIcon className="w-5 h-5 text-[var(--accent)]" />
                  <span className="font-semibold text-base">Redirect Chain</span>
                </div>
                <div className="flex flex-col items-center">
                  {sampleScanData.redirectChain.map((hop, hopIdx) => (
                    <div key={hop.url} className="w-full">
                      <div className="flex items-center gap-2 p-2 bg-[var(--surface-mid)]/20 rounded border border-[var(--gray-border)]/30">
                        <span className={`font-mono text-sm shrink-0 ${hop.statusCode === 200 ? "text-emerald-400" : "text-amber-400"}`}>
                          {hop.statusCode}
                        </span>
                        <span className="text-sm font-mono truncate text-[var(--foreground)]">{hop.url}</span>
                      </div>
                      {hopIdx < sampleScanData.redirectChain.length - 1 && (
                        <div className="flex justify-center py-1">
                          <div className="w-0.5 h-4 bg-[var(--accent)]/50" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* History */}
            <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20">
              <CardContent className={paddingClass}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-[var(--accent)]" />
                    <span className="font-semibold text-base">Previous Scans</span>
                  </div>
                  <Button variant="ghost" size="sm" className="text-sm h-6">
                    View All
                  </Button>
                </div>
                <div className="space-y-2">
                  {sampleHistory.map((scan) => (
                    <div 
                      key={scan.scanId}
                      className="flex items-center justify-between p-2 rounded border border-transparent hover:border-amber-400/50 hover:bg-[var(--surface-mid)]/30 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className={`w-3.5 h-3.5 ${scan.status === "completed" ? "text-emerald-400" : "text-red-400"}`} />
                        <span className="font-mono text-sm text-[var(--foreground)]">{scan.date}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                        <span>{scan.technologies} tech</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Scan Info */}
            <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20">
              <CardContent className={paddingClass}>
                <div className="flex items-center gap-2 mb-4">
                  <Info className="w-5 h-5 text-[var(--accent)]" />
                  <span className="font-semibold text-base">Scan Info</span>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">Source</span>
                    <span className="font-mono">{sampleScanData.source}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">Submitted</span>
                    <span className="font-mono">Mar 29, 18:28</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">Completed</span>
                    <span className="font-mono">Mar 29, 18:30</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">ASN</span>
                    <span className="font-mono">{sampleScanData.asnNumber}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Body Domains Preview */}
            <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20">
              <CardContent className={paddingClass}>
                <div className="flex items-center gap-2 mb-4">
                  <Globe2 className="w-5 h-5 text-[var(--accent)]" />
                  <span className="font-semibold text-base">Body Domains</span>
                  <Badge variant="outline" className="ml-auto text-sm">{sampleScanData.bodyDomains.length}</Badge>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {(domainViewAll ? sampleScanData.bodyDomains : sampleScanData.bodyDomains.slice(0, 12)).map((domain) => (
                    <span key={domain} className="text-sm text-[var(--muted-foreground)]">
                      {domain}{", "}
                    </span>
                  ))}
                </div>
                {sampleScanData.bodyDomains.length > 12 && (
                  <button 
                    type="button"
                    onClick={() => setDomainViewAll(!domainViewAll)}
                    className="text-sm text-[var(--accent)] hover:underline flex items-center gap-1"
                  >
                    {domainViewAll ? (
                      <>View less</>
                    ) : (
                      <>View all {sampleScanData.bodyDomains.length} domains</>
                    )}
                  </button>
                )}
              </CardContent>
            </Card>

          </div>
        )}
      </div>
    </div>
  )
}
