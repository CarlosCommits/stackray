import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { BadgePlus, Radar } from "lucide-react"

const profiles = ["stack-default", "stack-js", "stack-deep", "fingerprint-light"] as const

export default function NewScanPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BadgePlus className="w-5 h-5 text-[var(--accent)]" />
        <h1 className="font-[var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
          New Scan
        </h1>
      </div>

      <Card className="max-w-3xl bg-[var(--surface-dark)] border-[var(--gray-border)]">
        <CardHeader>
          <CardTitle className="text-[var(--foreground)]">Scan Configuration</CardTitle>
          <CardDescription className="text-[var(--text-dim)]">
            Start with a single target or paste a small batch list. Real submission will wire into the queue later.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="target" className="text-[var(--foreground)]">Primary target</Label>
            <Input
              id="target"
              defaultValue="https://tpss.coop"
              className="bg-[var(--surface-mid)] border-[var(--gray-border)] text-[var(--foreground)]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-list" className="text-[var(--foreground)]">Optional target list</Label>
            <Textarea
              id="target-list"
              placeholder="https://example.com&#10;https://docs.example.com"
              className="min-h-36 bg-[var(--surface-mid)] border-[var(--gray-border)] text-[var(--foreground)]"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-[var(--foreground)]">Profile</Label>
            <div className="flex flex-wrap gap-2">
              {profiles.map((profile, index) => (
                <Button
                  key={profile}
                  variant={index === 0 ? "default" : "outline"}
                  className={index === 0 ? "bg-[var(--accent)] text-[var(--primary-foreground)]" : "border-[var(--gray-border)] text-[var(--text-dim)] hover:text-[var(--foreground)]"}
                >
                  {profile}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-[var(--gray-border)] bg-[var(--surface-mid)] p-4">
            <div className="space-y-1">
              <p className="font-medium text-[var(--foreground)]">Scaffold mode</p>
              <p className="text-sm text-[var(--text-dim)]">This page currently targets mock route handlers and typed contracts.</p>
            </div>
            <Radar className="w-5 h-5 text-[var(--accent)]" />
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" className="border-[var(--gray-border)] text-[var(--foreground)]">
              Save Draft
            </Button>
            <Button className="bg-[var(--accent)] text-[var(--primary-foreground)] hover:bg-[var(--accent)]/80">
              Queue Scan
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
