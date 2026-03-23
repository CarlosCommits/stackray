"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Zap } from "lucide-react"

export function SearchCommandBar() {
  return (
    <div className="mb-6 w-full">
      <Card className="mx-auto flex w-full max-w-5xl flex-row items-center gap-3 rounded-2xl border-[var(--gray-border)] bg-[var(--surface-mid)] p-2 pr-2.5 shadow-2xl">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Search className="ml-1 size-4 shrink-0 text-[var(--accent)]" />
          <Input
            placeholder="https://target-domain.io"
            className="h-10 w-full border-none bg-transparent px-1 text-sm font-mono text-[var(--foreground)] placeholder:text-[var(--text-dim)]/40 focus-visible:ring-0"
          />
        </div>
        <div className="shrink-0">
          <Button className="h-10 min-w-36 rounded-xl bg-[var(--accent)] px-8 text-xs font-bold uppercase tracking-[0.22em] text-[var(--primary-foreground)] shadow-lg shadow-[var(--accent)]/20 transition-all hover:bg-[var(--accent)]/85 hover:shadow-[var(--accent)]/30">
            <Zap className="mr-1.5 size-3.5" data-icon="inline-start" />
            Scan
          </Button>
        </div>
      </Card>
    </div>
  )
}
