"use client"

import { Search, Zap } from "lucide-react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Button } from "@/components/ui/button"

export function SearchCommandBar() {
  return (
    <div className="mb-6 w-full">
      <InputGroup className="mx-auto h-auto w-full max-w-5xl rounded-2xl border-[var(--gray-border)] bg-[var(--surface-mid)] p-2 shadow-2xl has-[data-slot=input-group-control]:focus-within:border-[var(--accent)] has-[data-slot=input-group-control]:focus-within:ring-2 has-[data-slot=input-group-control]:focus-within:ring-[var(--accent)]/50">
        <InputGroupAddon align="inline-start" className="pl-1">
          <Search className="size-4 text-[var(--accent)]" />
        </InputGroupAddon>
        <InputGroupInput
          placeholder="https://target-domain.io"
          className="h-10 px-1 text-sm font-mono text-[var(--foreground)] placeholder:text-[var(--text-dim)]/40"
        />
        <InputGroupAddon align="inline-end" className="pr-0.5">
          <Button
            size="default"
            className="h-10 min-w-36 rounded-xl bg-[var(--accent)] px-8 text-xs font-bold uppercase tracking-[0.22em] text-[var(--primary-foreground)] shadow-lg shadow-[var(--accent)]/20 transition-all hover:bg-[var(--accent)]/85 hover:shadow-[var(--accent)]/30"
          >
            <Zap className="mr-1.5 size-3.5" data-icon="inline-start" />
            Scan
          </Button>
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}
