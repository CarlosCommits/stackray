"use client"

import { useState, type SyntheticEvent } from "react"

import type { AppUser } from "@/lib/contracts/users"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Check, Copy, ShieldCheck, Trash2 } from "lucide-react"

const USER_LAST_LOGIN_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "numeric",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "UTC",
})

function formatUserLastLogin(value: string) {
  return USER_LAST_LOGIN_FORMAT.format(new Date(value))
}

const roles: AppUser["role"][] = ["admin", "user", "viewer"]

function TempPasswordBanner({ password, onCopy, copied }: { password: string; onCopy: () => void; copied: boolean }) {
  return (
    <div className="space-y-3 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-[var(--accent)]" />
            <p className="text-sm font-medium text-[var(--foreground)]">Temporary password created: copy it now</p>
          </div>
          <p className="text-xs text-[var(--text-dim)]">
            For security, this password will not be shown again. Share it with the user through a secure channel.
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
              Copy password
            </>
          )}
        </Button>
      </div>
      <code className="block max-w-full overflow-x-auto rounded bg-[var(--surface-dark)] px-3 py-2 text-xs font-mono text-[var(--foreground)]">
        {password}
      </code>
    </div>
  )
}

function UserDeleteDialog({
  open,
  onOpenChange,
  user,
  onDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: AppUser | null
  onDelete: (userId: string) => Promise<boolean>
}) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!user) {
      return
    }

    try {
      setIsDeleting(true)
      const deleted = await onDelete(user.userId)

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
          <DialogTitle>Delete user</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{user?.displayName}&quot; ({user?.email})? This action cannot be undone.
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

export function UsersPageClient({
  initialUsers,
  canEmailUsers,
  currentUserId,
}: {
  initialUsers: AppUser[]
  canEmailUsers: boolean
  currentUserId: string
}) {
  const [users, setUsers] = useState(initialUsers)
  const [error, setError] = useState<string | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null)
  const [form, setForm] = useState({
    email: "",
    displayName: "",
    role: "user" as AppUser["role"],
    deliveryMode: canEmailUsers ? "email" : "temp-password",
  })

  const refreshUsers = async () => {
    const response = await fetch("/api/v1/settings/users")
    const payload = await response.json()
    setUsers(payload.items ?? [])
  }

  const handleCreateUser = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setTempPassword(null)
    setCopied(false)

    const response = await fetch("/api/v1/settings/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      setError(payload?.error?.message ?? "Unable to create the user.")
      return
    }

    setTempPassword(payload.temporaryPassword ?? null)
    setForm({
      email: "",
      displayName: "",
      role: "user",
      deliveryMode: canEmailUsers ? "email" : "temp-password",
    })
    await refreshUsers()
  }

  const handleRoleChange = async (userId: string, role: AppUser["role"]) => {
    setError(null)
    const response = await fetch(`/api/v1/settings/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      setError(payload?.error?.message ?? "Unable to update the role.")
      return
    }

    setUsers((currentUsers) => currentUsers.map((user) => (user.userId === userId ? payload : user)))
  }

  const handleTokenAccessChange = async (userId: string, apiTokenAccessEnabled: boolean) => {
    setError(null)
    const response = await fetch(`/api/v1/settings/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiTokenAccessEnabled }),
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      setError(payload?.error?.message ?? "Unable to update API token access.")
      return
    }

    setUsers((currentUsers) => currentUsers.map((user) => (user.userId === userId ? payload : user)))
  }

  const handleResetPassword = async (userId: string, deliveryMode: "email" | "temp-password") => {
    setError(null)
    setTempPassword(null)
    setCopied(false)
    const response = await fetch(`/api/v1/settings/users/${userId}/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryMode }),
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      setError(payload?.error?.message ?? "Unable to reset the password.")
      return
    }

    setTempPassword(payload.temporaryPassword ?? null)
    await refreshUsers()
  }

  const handleDeleteUser = async (userId: string) => {
    setError(null)
    const response = await fetch(`/api/v1/settings/users/${userId}`, {
      method: "DELETE",
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      setError(payload?.error?.message ?? "Unable to delete the user.")
      return false
    }

    setUsers((currentUsers) => currentUsers.filter((user) => user.userId !== userId))
    return true
  }

  const handleCopyPassword = async () => {
    if (!tempPassword) {
      return
    }

    await navigator.clipboard.writeText(tempPassword)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-[var(--foreground)]">Users</h1>
          <p className="text-sm text-[var(--text-dim)]">
            Provision accounts, manage roles, and issue password resets.
          </p>
        </div>
        
      </div>

      <Card className="border-[var(--gray-border)] bg-[var(--surface-dark)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-[var(--foreground)]">Create user</CardTitle>
          <CardDescription className="text-[var(--text-dim)]">
            Choose email delivery when Resend is configured, or issue a temporary password for manual handoff.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={handleCreateUser}>
            <div className="space-y-2">
              <Label htmlFor="user-email" className="text-[var(--foreground)]">Email</Label>
              <Input id="user-email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="bg-[var(--surface-mid)] border-[var(--gray-border)] text-[var(--foreground)]" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-display-name" className="text-[var(--foreground)]">Display name</Label>
              <Input id="user-display-name" value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} className="bg-[var(--surface-mid)] border-[var(--gray-border)] text-[var(--foreground)]" required />
            </div>
            <div className="space-y-2">
              <Label className="text-[var(--foreground)]">Role</Label>
              <Select value={form.role} onValueChange={(value) => setForm((current) => ({ ...current, role: value as AppUser["role"] }))}>
                <SelectTrigger className="w-full border-[var(--gray-border)] bg-[var(--surface-mid)] text-[var(--foreground)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {roles.map((role) => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[var(--foreground)]">Password delivery</Label>
              <Select value={form.deliveryMode} onValueChange={(value) => setForm((current) => ({ ...current, deliveryMode: value as "email" | "temp-password" }))}>
                <SelectTrigger className="w-full border-[var(--gray-border)] bg-[var(--surface-mid)] text-[var(--foreground)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {canEmailUsers && <SelectItem value="email">Email reset link</SelectItem>}
                    <SelectItem value="temp-password">Temporary password</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-end">
              <Button type="submit" className="bg-[var(--accent)] text-[var(--primary-foreground)] hover:bg-[var(--accent)]/80">Create user</Button>
            </div>
          </form>
          {tempPassword && (
            <TempPasswordBanner
              password={tempPassword}
              onCopy={() => void handleCopyPassword()}
              copied={copied}
            />
          )}
          {error && <p aria-live="polite" className="mt-4 text-sm text-red-400">{error}</p>}
        </CardContent>
      </Card>

      <Card className="border-[var(--gray-border)] bg-[var(--surface-dark)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-[var(--foreground)]">Current users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>API tokens</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.userId}>
                    <TableCell className="min-w-0">
                      <div>
                        <p className="truncate font-medium text-[var(--foreground)]">{user.displayName}</p>
                        <p className="truncate text-xs text-[var(--text-dim)]">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select value={user.role} onValueChange={(value) => void handleRoleChange(user.userId, value as AppUser["role"])} disabled={user.userId === currentUserId}>
                        <SelectTrigger className="w-24 border-[var(--gray-border)] bg-[var(--surface-mid)] text-[var(--foreground)]" aria-label={`Role for ${user.displayName}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {roles.map((role) => (
                              <SelectItem key={role} value={role}>{role}</SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-[var(--gray-border)] text-[var(--text-dim)]">
                          {user.isActive ? "active" : "inactive"}
                        </Badge>
                        {user.requiresPasswordChange && (
                          <Badge variant="outline" className="border-amber-500/50 text-amber-400">
                            must change password
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.role === "admin" ? (
                        <Badge variant="outline" className="border-[var(--gray-border)] text-[var(--text-dim)]">
                          Always enabled
                        </Badge>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                          <Switch
                            checked={user.apiTokenAccessEnabled}
                            onCheckedChange={(checked) => void handleTokenAccessChange(user.userId, checked)}
                            aria-label={`API token access for ${user.displayName}`}
                          />
                          <span>{user.apiTokenAccessEnabled ? "Enabled" : "Disabled"}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[var(--text-dim)] text-sm">
                      {user.lastLoginAt ? formatUserLastLogin(user.lastLoginAt) : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {canEmailUsers && (
                          <Button variant="outline" size="sm" className="border-[var(--gray-border)] text-[var(--foreground)]" onClick={() => void handleResetPassword(user.userId, "email")}>Email reset</Button>
                        )}
                        <Button variant="outline" size="sm" className="border-[var(--gray-border)] text-[var(--foreground)]" onClick={() => void handleResetPassword(user.userId, "temp-password")}>Temp password</Button>
                        <Button variant="outline" size="sm" className="border-red-500/40 text-red-400 hover:border-red-500/60 hover:bg-red-500/5" onClick={() => setUserToDelete(user)} disabled={user.userId === currentUserId}>
                          <Trash2 data-icon="inline-start" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <UserDeleteDialog
        open={userToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setUserToDelete(null)
          }
        }}
        user={userToDelete}
        onDelete={handleDeleteUser}
      />
    </div>
  )
}
