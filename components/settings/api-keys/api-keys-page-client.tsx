"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"

import type { ApiKey } from "@/lib/contracts/api-keys"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { LocalTime } from "@/components/ui/local-time"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BookOpen, Check, Copy, KeyRound, Plus, Trash2 } from "lucide-react"

function maskApiKeyHint(keyHint: string | null) {
  return `${keyHint ?? "sr_live"}••••••••••••`
}

function ApiDocsQuickstartCard() {
  return (
    <Card size="sm" className="border-[var(--gray-border)] bg-[var(--surface-mid)] shadow-2xl shadow-black/10">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
            <BookOpen className="size-4" />
          </div>
          <CardTitle className="text-[var(--foreground)]">API quick start</CardTitle>
        </div>
        <CardDescription className="text-[var(--text-dim)]">
          The short path from a new bearer API key to a working request.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 text-sm text-[var(--text-dim)]">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-[var(--surface-dark)] text-xs font-medium text-[var(--accent)]">1</span>
            <p>Create an API key and copy it before closing the dialog.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-[var(--surface-dark)] text-xs font-medium text-[var(--accent)]">2</span>
            <p>Set the API key as a bearer credential in your API client.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-[var(--surface-dark)] text-xs font-medium text-[var(--accent)]">3</span>
            <p>Call the scan and schedule endpoints from automation.</p>
          </div>
        </div>
        <div className="rounded-lg bg-[var(--surface-dark)] p-3">
          <code className="block truncate font-mono text-xs text-[var(--text-dim)]">
            Authorization: Bearer sr_live_...
          </code>
        </div>
        <div className="flex flex-col gap-2 border-t border-[var(--gray-border)] pt-3">
          <Link
            href="/settings/api-docs"
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent)] hover:underline"
          >
            <BookOpen className="size-4" />
            Read the guide
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

function ApiKeyCreatedBanner({ apiKey, onCopy, copied }: { apiKey: string; onCopy: () => void; copied: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Check className="size-4 text-[var(--accent)]" />
            <p className="text-sm font-medium text-[var(--foreground)]">API key created: copy it now</p>
          </div>
          <p className="text-xs text-[var(--text-dim)]">
            For security, Stackray only shows the full API key once. Store it somewhere safe.
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
              <Check data-icon="inline-start" />
              Copied
            </>
          ) : (
            <>
              <Copy data-icon="inline-start" />
              Copy API key
            </>
          )}
        </Button>
      </div>
      <code className="block max-w-full overflow-x-auto rounded bg-[var(--surface-dark)] px-3 py-2 text-xs font-mono text-[var(--foreground)]">
        {apiKey}
      </code>
    </div>
  )
}

function ApiKeysEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Empty className="min-h-[20rem] border border-dashed border-[var(--gray-border)] bg-[var(--surface-mid)]/45">
      <EmptyHeader>
        <EmptyMedia
          variant="default"
          className="flex size-12 items-center justify-center rounded-lg bg-[var(--surface-light)] text-[var(--text-dim)]"
        >
          <KeyRound className="size-6" />
        </EmptyMedia>
        <EmptyTitle>No API keys yet</EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <Button type="button" onClick={onCreate}>
          <Plus data-icon="inline-start" />
          Create API key
        </Button>
      </EmptyContent>
    </Empty>
  )
}

function ApiKeyCreateDialog({
  open,
  onOpenChange,
  name,
  onNameChange,
  plainTextApiKey,
  copied,
  error,
  isCreating,
  onSubmit,
  onCopy,
  onCreateAnother,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  onNameChange: (name: string) => void
  plainTextApiKey: string | null
  copied: boolean
  error: string | null
  isCreating: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onCopy: () => void
  onCreateAnother: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button">
          <Plus data-icon="inline-start" />
          Create API key
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-lg"
        showCloseButton={!isCreating}
        onEscapeKeyDown={(event) => {
          if (isCreating) {
            event.preventDefault()
          }
        }}
        onInteractOutside={(event) => {
          if (isCreating) {
            event.preventDefault()
          }
        }}
        onPointerDownOutside={(event) => {
          if (isCreating) {
            event.preventDefault()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Create API key</DialogTitle>
          <DialogDescription>
            Name the API key for the system or workflow that will use it. The full key is shown once.
          </DialogDescription>
        </DialogHeader>

        {plainTextApiKey ? (
          <div className="flex flex-col gap-4">
            <ApiKeyCreatedBanner apiKey={plainTextApiKey} onCopy={onCopy} copied={copied} />
            <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              Keep only the API key hint in Stackray. Store the full value in your password manager, CI secrets, or runtime environment.
            </div>
          </div>
        ) : (
          <form id="create-api-key-form" className="flex flex-col gap-4" onSubmit={onSubmit}>
            <FieldGroup>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="api-key-name">API key name</FieldLabel>
                <Input
                  id="api-key-name"
                  value={name}
                  onChange={(event) => onNameChange(event.target.value)}
                  placeholder="Stackray API access"
                  required
                  minLength={1}
                  aria-invalid={Boolean(error)}
                  disabled={isCreating}
                />
                <FieldDescription>
                  Use a name that identifies where the API key will be stored or used.
                </FieldDescription>
                {error && <FieldError>{error}</FieldError>}
              </Field>
            </FieldGroup>
          </form>
        )}

        <DialogFooter>
          {plainTextApiKey ? (
            <>
              <Button type="button" variant="outline" onClick={onCreateAnother}>
                Create another
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
                Cancel
              </Button>
              <Button type="submit" form="create-api-key-form" disabled={isCreating}>
                {isCreating ? "Creating..." : "Create API key"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ApiKeyRevokeDialog({
  open,
  onOpenChange,
  apiKey,
  onRevoke,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiKey: ApiKey | null
  onRevoke: (apiKeyId: string) => Promise<boolean>
}) {
  const [isRevoking, setIsRevoking] = useState(false)

  const handleRevoke = async () => {
    if (!apiKey) {
      return
    }

    try {
      setIsRevoking(true)
      const revoked = await onRevoke(apiKey.id)

      if (revoked) {
        onOpenChange(false)
      }
    } finally {
      setIsRevoking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (isRevoking) {
        return
      }

      onOpenChange(nextOpen)
    }}>
      <DialogContent
        showCloseButton={!isRevoking}
        onEscapeKeyDown={(event) => {
          if (isRevoking) {
            event.preventDefault()
          }
        }}
        onInteractOutside={(event) => {
          if (isRevoking) {
            event.preventDefault()
          }
        }}
        onPointerDownOutside={(event) => {
          if (isRevoking) {
            event.preventDefault()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Revoke API key</DialogTitle>
          <DialogDescription>
            Are you sure you want to revoke &quot;{apiKey?.name}&quot;? Existing requests with this API key will stop working.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isRevoking}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void handleRevoke()} disabled={isRevoking}>
            {isRevoking ? "Revoking..." : "Revoke API key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ApiKeyTableRow({ apiKey, onRevoke }: { apiKey: ApiKey; onRevoke: (apiKey: ApiKey) => void }) {
  return (
    <TableRow className="border-[var(--gray-border)]/60 hover:bg-[var(--surface-mid)]/55">
      <TableCell className="min-w-0 max-w-[28rem] py-3 pr-4 md:min-w-64 md:pr-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--surface-mid)] text-[var(--accent)]">
            <KeyRound className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-[var(--foreground)]">{apiKey.name}</p>
            <code className="block truncate font-mono text-xs text-[var(--text-dim)]">{maskApiKeyHint(apiKey.keyHint)}</code>
            <div className="mt-2 flex flex-col gap-1 text-xs text-[var(--text-dim)] md:hidden">
              <span>Created <LocalTime value={apiKey.createdAt} preset="shortDateTimeWithZone" /></span>
              <span>Last used <LocalTime value={apiKey.lastUsedAt} preset="shortDateTimeWithZone" unavailableLabel="Never" /></span>
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden w-px whitespace-nowrap px-4 py-3 text-sm text-[var(--text-dim)] md:table-cell">
        <LocalTime value={apiKey.createdAt} preset="fullDateTimeSecondsWithZone" />
      </TableCell>
      <TableCell className="hidden w-px whitespace-nowrap px-4 py-3 text-sm text-[var(--text-dim)] md:table-cell">
        <LocalTime value={apiKey.lastUsedAt} preset="fullDateTimeSecondsWithZone" unavailableLabel="Never" />
      </TableCell>
      <TableCell className="w-12 py-3 pl-2 text-right md:w-px md:pl-4">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="border-red-500/40 text-red-400 hover:border-red-500/60 hover:bg-red-500/5"
          onClick={() => onRevoke(apiKey)}
          aria-label={`Revoke ${apiKey.name}`}
        >
          <Trash2 />
        </Button>
      </TableCell>
    </TableRow>
  )
}

export function ApiKeysPageClient({ initialApiKeys }: { initialApiKeys: ApiKey[] }) {
  const [apiKeys, setApiKeys] = useState(initialApiKeys)
  const [name, setName] = useState("")
  const [plainTextApiKey, setPlainTextApiKey] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [apiKeyToRevoke, setApiKeyToRevoke] = useState<ApiKey | null>(null)

  const handleCreateApiKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()

    if (!trimmedName) {
      setCreateError("Enter an API key name.")
      return
    }

    setCreateError(null)
    setPageError(null)
    setCopied(false)
    setIsCreating(true)

    try {
      const response = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setCreateError(payload?.error?.message ?? "Unable to create API key.")
        return
      }

      setApiKeys((current) => [payload.apiKey, ...current])
      setPlainTextApiKey(payload.plainTextApiKey ?? null)
      setName("")
    } finally {
      setIsCreating(false)
    }
  }

  const handleRevokeApiKey = async (apiKeyId: string) => {
    setPageError(null)

    const response = await fetch(`/api/v1/api-keys/${apiKeyId}`, {
      method: "DELETE",
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      setPageError(payload?.error?.message ?? "Unable to revoke API key.")
      return false
    }

    setApiKeys((current) => current.filter((apiKey) => apiKey.id !== apiKeyId))
    return true
  }

  const handleCopyApiKey = async () => {
    if (!plainTextApiKey) {
      return
    }

    await navigator.clipboard.writeText(plainTextApiKey)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const handleCreateDialogOpenChange = (nextOpen: boolean) => {
    if (isCreating) {
      return
    }

    if (nextOpen) {
      setCreateError(null)
    } else {
      setPlainTextApiKey(null)
      setCopied(false)
      setName("")
      setCreateError(null)
    }

    setCreateDialogOpen(nextOpen)
  }

  const handleCreateAnother = () => {
    setPlainTextApiKey(null)
    setCopied(false)
    setCreateError(null)
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex justify-end">
        <ApiKeyCreateDialog
          open={createDialogOpen}
          onOpenChange={handleCreateDialogOpenChange}
          name={name}
          onNameChange={setName}
          plainTextApiKey={plainTextApiKey}
          copied={copied}
          error={createError}
          isCreating={isCreating}
          onSubmit={(event) => void handleCreateApiKey(event)}
          onCopy={() => void handleCopyApiKey()}
          onCreateAnother={handleCreateAnother}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <Card className={`border-[var(--gray-border)] bg-[var(--surface-dark)] ${apiKeys.length === 0 ? "min-h-[34rem]" : ""}`}>
          <CardHeader className="border-b border-[var(--gray-border)]/70 pb-4">
            <CardTitle className="text-[var(--foreground)]">Your API keys</CardTitle>
            <CardDescription className="text-[var(--text-dim)]">
              Revoke API keys you no longer need. Full API key values cannot be revealed again after creation.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            {pageError && <p aria-live="polite" className="text-sm text-red-400">{pageError}</p>}
            {apiKeys.length === 0 ? (
              <ApiKeysEmptyState onCreate={() => setCreateDialogOpen(true)} />
            ) : (
              <div className="max-w-full overflow-x-auto">
                <Table className="min-w-full table-fixed md:table-auto">
                  <TableHeader>
                    <TableRow className="border-[var(--gray-border)]/70 hover:bg-transparent">
                      <TableHead className="min-w-0 pr-4 md:min-w-64 md:pr-8">Key</TableHead>
                      <TableHead className="hidden w-px px-4 md:table-cell">Created</TableHead>
                      <TableHead className="hidden w-px px-4 md:table-cell">Last used</TableHead>
                      <TableHead className="w-12 pl-2 text-right md:w-px md:pl-4">
                        <span className="md:hidden">Action</span>
                        <span className="hidden md:inline">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys.map((apiKey) => (
                      <ApiKeyTableRow
                        key={apiKey.id}
                        apiKey={apiKey}
                        onRevoke={setApiKeyToRevoke}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <aside className="xl:sticky xl:top-6">
          <ApiDocsQuickstartCard />
        </aside>
      </div>

      <ApiKeyRevokeDialog
        open={apiKeyToRevoke !== null}
        onOpenChange={(open) => {
          if (!open) {
            setApiKeyToRevoke(null)
          }
        }}
        apiKey={apiKeyToRevoke}
        onRevoke={handleRevokeApiKey}
      />
    </div>
  )
}
