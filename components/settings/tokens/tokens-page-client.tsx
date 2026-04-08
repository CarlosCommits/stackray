"use client"

import { useMemo, useState } from "react"
import Link from "next/link"

import type { ApiToken } from "@/lib/contracts/tokens"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BookOpen, Copy, Key, ShieldCheck, Terminal, Trash2 } from "lucide-react"

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Never"
  }

  return new Date(value).toLocaleString()
}

function maskTokenHint(tokenHint: string | null) {
  return `${tokenHint ?? "sr_live"}••••••••••••`
}

function ApiDocsQuickstartCard() {
  return (
    <Card className="border-[var(--gray-border)] bg-[var(--surface-mid)]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/10">
            <BookOpen className="size-5 text-[var(--accent)]" />
          </div>
          <CardTitle className="text-base font-semibold text-[var(--foreground)] md:text-lg">
            API Quickstart Guide
          </CardTitle>
        </div>
        <CardDescription className="text-sm text-[var(--text-dim)]">
          New to the Stackray API? Start here to learn how to authenticate and make your first request.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-3 text-sm text-[var(--text-dim)]">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-dark)] text-xs font-medium text-[var(--accent)]">1</span>
            <p>Create a token using the form on this page</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-dark)] text-xs font-medium text-[var(--accent)]">2</span>
            <p>Set your base URL and token in your environment</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-dark)] text-xs font-medium text-[var(--accent)]">3</span>
            <p>Make your first authenticated request</p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Link
            href="/settings/api-docs"
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent)] hover:underline"
          >
            <BookOpen className="size-4" />
            Read the quickstart guide
          </Link>
          <Link
            href="/settings/api-docs#token-management"
            className="inline-flex items-center gap-2 text-sm text-[var(--text-dim)] hover:text-[var(--foreground)]"
          >
            <Terminal className="size-4" />
            Token management reference
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

function TokenCreatedBanner({ token, onCopy, copied }: { token: string; onCopy: () => void; copied: boolean }) {
  return (
    <div className="space-y-3 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-[var(--accent)]" />
            <p className="text-sm font-medium text-[var(--foreground)]">Token created — copy it now</p>
          </div>
          <p className="text-xs text-[var(--text-dim)]">
            For security, Stackray only shows the full token once. Store it somewhere safe.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 border-[var(--gray-border)] text-[var(--foreground)]"
          onClick={onCopy}
        >
          {copied ? (
            <>
              <Copy className="size-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" />
              Copy token
            </>
          )}
        </Button>
      </div>
      <code className="block max-w-full overflow-x-auto rounded bg-[var(--surface-dark)] px-3 py-2 text-xs font-mono text-[var(--foreground)]">
        {token}
      </code>
    </div>
  )
}

function TokensEmptyState() {
  return (
    <Empty className="border-dashed border-[var(--gray-border)]">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <div className="flex size-12 items-center justify-center rounded-full bg-[var(--surface-light)]">
            <Key className="size-6 text-[var(--text-dim)]" />
          </div>
        </EmptyMedia>
        <EmptyTitle>No API tokens yet</EmptyTitle>
        <EmptyDescription>
          Create your first token to authenticate with the Stackray API. Tokens are shown once and stored securely.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function TokenDeleteDialog({
  open,
  onOpenChange,
  token,
  onDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  token: ApiToken | null
  onDelete: (tokenId: string) => Promise<boolean>
}) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!token) {
      return
    }

    try {
      setIsDeleting(true)
      const deleted = await onDelete(token.id)

      if (deleted) {
        onOpenChange(false)
      }
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (isDeleting) {
        return
      }

      onOpenChange(nextOpen)
    }}>
      <DialogContent
        showCloseButton={!isDeleting}
        onEscapeKeyDown={(event) => {
          if (isDeleting) {
            event.preventDefault()
          }
        }}
        onInteractOutside={(event) => {
          if (isDeleting) {
            event.preventDefault()
          }
        }}
        onPointerDownOutside={(event) => {
          if (isDeleting) {
            event.preventDefault()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Delete API token</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{token?.name}&quot;? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void handleDelete()} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TokenListItem({ token, onDelete }: { token: ApiToken; onDelete: (token: ApiToken) => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--gray-border)] bg-[var(--surface-mid)] p-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0 space-y-2">
        <p className="truncate font-medium text-[var(--foreground)]">{token.name}</p>
        <code className="block truncate text-xs text-[var(--text-dim)]">{maskTokenHint(token.tokenHint)}</code>
        <div className="space-y-0.5 text-xs text-[var(--text-dim)]">
          <div>Created: {formatTimestamp(token.createdAt)}</div>
          <div>Last used: {formatTimestamp(token.lastUsedAt)}</div>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 border-red-500/40 text-red-400 hover:border-red-500/60 hover:bg-red-500/5"
        onClick={() => onDelete(token)}
      >
        <Trash2 className="size-3.5" />
        Delete
      </Button>
    </div>
  )
}

export function TokensPageClient({ initialTokens }: { initialTokens: ApiToken[] }) {
  const [tokens, setTokens] = useState(initialTokens)
  const [name, setName] = useState("")
  const [plainTextToken, setPlainTextToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [tokenToDelete, setTokenToDelete] = useState<ApiToken | null>(null)

  const tokenCountLabel = useMemo(() => `${tokens.length} token${tokens.length === 1 ? "" : "s"}`, [tokens])

  const handleCreateToken = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setCopied(false)

    const response = await fetch("/api/v1/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      setError(payload?.error?.message ?? "Unable to create API token.")
      return
    }

    setTokens((current) => [payload.token, ...current])
    setPlainTextToken(payload.plainTextToken ?? null)
    setName("")
  }

  const handleDeleteToken = async (tokenId: string) => {
    setError(null)

    const response = await fetch(`/api/v1/tokens/${tokenId}`, {
      method: "DELETE",
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      setError(payload?.error?.message ?? "Unable to delete API token.")
      return false
    }

    setTokens((current) => current.filter((token) => token.id !== tokenId))
    return true
  }

  const handleCopyToken = async () => {
    if (!plainTextToken) {
      return
    }

    await navigator.clipboard.writeText(plainTextToken)
    setCopied(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-[var(--foreground)]">API Tokens</h1>
          <p className="text-sm text-[var(--text-dim)]">
            Create bearer tokens for Stackray API and automation access.
          </p>
        </div>
        {tokens.length > 0 && (
          <Badge variant="outline" className="shrink-0 border-[var(--gray-border)] text-[var(--text-dim)]">
            {tokenCountLabel}
          </Badge>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          <Card className="border-[var(--gray-border)] bg-[var(--surface-dark)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-[var(--foreground)]">Create token</CardTitle>
              <CardDescription className="text-[var(--text-dim)]">
                Give your token a descriptive name to remember its purpose.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="space-y-4" onSubmit={handleCreateToken}>
                <div className="space-y-2">
                  <Label htmlFor="token-name" className="text-[var(--foreground)]">Token name</Label>
                  <Input
                    id="token-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="border-[var(--gray-border)] bg-[var(--surface-mid)] text-[var(--foreground)]"
                    placeholder="My token"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-[var(--accent)] text-[var(--primary-foreground)] hover:bg-[var(--accent)]/80"
                >
                  Create token
                </Button>
              </form>

              {plainTextToken && (
                <TokenCreatedBanner
                  token={plainTextToken}
                  onCopy={() => void handleCopyToken()}
                  copied={copied}
                />
              )}

              {error && <p className="text-sm text-red-400">{error}</p>}
            </CardContent>
          </Card>

          <ApiDocsQuickstartCard />
        </div>

        <div className="lg:col-span-3">
          <Card className="border-[var(--gray-border)] bg-[var(--surface-dark)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-[var(--foreground)]">Your tokens</CardTitle>
              <CardDescription className="text-[var(--text-dim)]">
                Delete tokens you no longer need. Tokens cannot be revealed again after creation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tokens.length === 0 ? (
                <TokensEmptyState />
              ) : (
                <div className="space-y-4">
                  {tokens.map((token) => (
                    <TokenListItem
                      key={token.id}
                      token={token}
                      onDelete={setTokenToDelete}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <TokenDeleteDialog
        open={tokenToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTokenToDelete(null)
          }
        }}
        token={tokenToDelete}
        onDelete={handleDeleteToken}
      />
    </div>
  )
}
