import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { isBootstrapOpen } from "@/lib/server/bootstrap/service"
import { DISPLAY_VERSION } from "@/lib/version"
import { 
  Search, 
  Zap, 
  Shield, 
  ArrowRight,
  Terminal,
  Layers
} from "lucide-react"

export default async function LandingPage() {
  if (await isBootstrapOpen()) {
    redirect("/setup")
  }

  return (
    <div className="min-h-screen bg-[var(--gray-charcoal)]">
      {/* Navigation */}
      <nav className="h-16 border-b border-[var(--gray-border)] bg-[var(--surface-dark)]/90 backdrop-blur flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[var(--accent)] rounded flex items-center justify-center font-bold text-xs text-[var(--primary-foreground)]">
            S
          </div>
          <span className="font-[var(--font-heading)] text-lg font-bold text-[var(--foreground)]">
            Stackray
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link 
            href="/sign-in" 
            className="text-sm text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors"
          >
            Sign In
          </Link>
          <Button className="bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-[var(--primary-foreground)]" asChild>
            <Link href="/sign-in">Get Started</Link>
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[var(--surface-mid)] border border-[var(--gray-border)] rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
            <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">
              {DISPLAY_VERSION} Now Available
            </span>
          </div>
          
          <h1 className="font-[var(--font-heading)] text-5xl md:text-6xl font-bold text-[var(--foreground)] mb-6 leading-tight">
            Discover What Powers
            <span className="text-gradient"> Any Website</span>
          </h1>
          
          <p className="text-lg text-[var(--text-dim)] mb-8 max-w-2xl mx-auto">
            Stackray is a modular workstation for site intelligence. 
            Scan targets, analyze technology stacks, and track changes over time.
          </p>

          {/* Quick Scan Input */}
          <Card className="bg-[var(--surface-mid)] border-[var(--gray-border)] p-2 pr-3 flex items-center gap-3 max-w-2xl mx-auto shadow-2xl">
            <Search className="w-5 h-5 text-[var(--accent)] ml-3" />
            <Input 
              placeholder="https://target-domain.io"
              className="bg-transparent border-none focus-visible:ring-0 text-sm font-mono w-full text-[var(--foreground)] placeholder:text-[var(--text-dim)]/30"
            />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-[var(--text-dim)] px-2 py-1 bg-[var(--surface-dark)] border border-[var(--gray-border)] rounded hidden sm:block">
                INTEL_DISCOVERY
              </span>
              <Button className="bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-[var(--primary-foreground)] text-[10px] font-bold px-4 py-2 rounded uppercase tracking-widest transition-all">
                Scan
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-6 border-t border-[var(--gray-border)]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)] widget-outline p-6">
              <div className="w-10 h-10 bg-[var(--accent)]/10 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-5 h-5 text-[var(--accent)]" />
              </div>
              <h3 className="font-[var(--font-heading)] text-lg font-bold text-[var(--foreground)] mb-2">
                Rapid Discovery
              </h3>
              <p className="text-sm text-[var(--text-dim)]">
                Scan any target in seconds. Get instant insights into technology stacks, 
                server configurations, and security headers.
              </p>
            </Card>

            <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)] widget-outline p-6">
              <div className="w-10 h-10 bg-[var(--accent)]/10 rounded-lg flex items-center justify-center mb-4">
                <Layers className="w-5 h-5 text-[var(--accent)]" />
              </div>
              <h3 className="font-[var(--font-heading)] text-lg font-bold text-[var(--foreground)] mb-2">
                Technology Index
              </h3>
              <p className="text-sm text-[var(--text-dim)]">
                Track 800+ technologies across your scan history. Identify trends, 
                version distributions, and adoption patterns.
              </p>
            </Card>

            <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)] widget-outline p-6">
              <div className="w-10 h-10 bg-[var(--accent)]/10 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-5 h-5 text-[var(--accent)]" />
              </div>
              <h3 className="font-[var(--font-heading)] text-lg font-bold text-[var(--foreground)] mb-2">
                Change Detection
              </h3>
              <p className="text-sm text-[var(--text-dim)]">
                Monitor targets over time. Get alerted when technology stacks change, 
                new services are deployed, or configurations drift.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Example Output */}
      <section className="py-16 px-6 border-t border-[var(--gray-border)]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-[var(--font-heading)] text-2xl font-bold text-[var(--foreground)] mb-2">
              Example Output
            </h2>
            <p className="text-sm text-[var(--text-dim)]">
              See what Stackray discovers about any target
            </p>
          </div>

          <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--gray-border)] bg-[var(--surface-mid)]">
              <div className="w-3 h-3 rounded-full bg-red-500/20" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/20" />
              <div className="w-3 h-3 rounded-full bg-green-500/20" />
              <span className="ml-2 text-[10px] font-mono text-[var(--text-dim)]">
                stackray scan payments.example.test
              </span>
            </div>
            <CardContent className="p-4 font-mono text-xs">
              <div className="space-y-2 text-[var(--text-dim)]">
                <div className="flex gap-4">
                  <span className="text-[var(--accent)]">TARGET</span>
                  <span className="text-[var(--foreground)]">payments.example.test (34.201.21.144)</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-[var(--accent)]">STATUS</span>
                  <span className="text-green-400">200 OK</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-[var(--accent)]">TECH</span>
                  <span className="text-[var(--foreground)]">React, Go, Stripe, AWS, Cloudflare</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-[var(--accent)]">SERVER</span>
                  <span className="text-[var(--foreground)]">nginx/1.18.0</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-[var(--accent)]">TLS</span>
                  <span className="text-[var(--foreground)]">1.3, Cloudflare CA</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-6 border-t border-[var(--gray-border)]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-[var(--font-heading)] text-3xl font-bold text-[var(--foreground)] mb-4">
            Ready to Start Scanning?
          </h2>
          <p className="text-[var(--text-dim)] mb-8">
            Join the alpha and get early access to the full Stackray platform.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button 
              size="lg"
              className="bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-[var(--primary-foreground)]"
              asChild
            >
              <Link href="/sign-in">
                <Terminal className="w-4 h-4 mr-2" />
                Open App
              </Link>
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              className="border-[var(--gray-border)] text-[var(--foreground)] hover:bg-[var(--surface-mid)]"
            >
              View Documentation
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-[var(--gray-border)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[var(--accent)] rounded flex items-center justify-center font-bold text-[10px] text-[var(--primary-foreground)]">
              S
            </div>
            <span className="text-sm text-[var(--text-dim)]">
              Stackray
            </span>
          </div>
          <p className="text-xs text-[var(--text-dim)]">
            Modular workstation for site intelligence
          </p>
        </div>
      </footer>
    </div>
  )
}
