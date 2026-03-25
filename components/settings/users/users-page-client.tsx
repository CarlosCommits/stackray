"use client"

import { useState } from "react"

import type { AppUser } from "@/lib/contracts/users"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const roles: AppUser["role"][] = ["admin", "user", "viewer"]

export function UsersPageClient({ initialUsers, canEmailUsers, currentRole }: { initialUsers: AppUser[]; canEmailUsers: boolean; currentRole: AppUser["role"] }) {
  const [users, setUsers] = useState(initialUsers)
  const [error, setError] = useState<string | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
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

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setTempPassword(null)

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

  const handleResetPassword = async (userId: string, deliveryMode: "email" | "temp-password") => {
    setError(null)
    setTempPassword(null)
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

  const handleDelete = async (userId: string) => {
    setError(null)
    const response = await fetch(`/api/v1/settings/users/${userId}`, {
      method: "DELETE",
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      setError(payload?.error?.message ?? "Unable to delete the user.")
      return
    }

    setUsers((currentUsers) => currentUsers.filter((user) => user.userId !== userId))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[var(--font-heading)] text-xl font-bold text-[var(--foreground)]">Users</h1>
          <p className="text-sm text-[var(--text-dim)]">Admins can provision accounts, manage roles, and issue reset flows.</p>
        </div>
        <Badge variant="outline" className="border-[var(--gray-border)] text-[var(--text-dim)] uppercase">
          {currentRole}
        </Badge>
      </div>

      <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]">
        <CardHeader>
          <CardTitle className="text-[var(--foreground)]">Create user</CardTitle>
          <CardDescription className="text-[var(--text-dim)]">
            Choose email delivery when Resend is configured, or issue a temporary password for manual handoff.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateUser}>
            <div className="space-y-2">
              <Label htmlFor="user-email" className="text-[var(--foreground)]">Email</Label>
              <Input id="user-email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="bg-[var(--surface-mid)] border-[var(--gray-border)] text-[var(--foreground)]" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-display-name" className="text-[var(--foreground)]">Display name</Label>
              <Input id="user-display-name" value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} className="bg-[var(--surface-mid)] border-[var(--gray-border)] text-[var(--foreground)]" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-role" className="text-[var(--foreground)]">Role</Label>
              <select id="user-role" value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as AppUser["role"] }))} className="h-8 w-full rounded-lg border border-[var(--gray-border)] bg-[var(--surface-mid)] px-2.5 text-sm text-[var(--foreground)]">
                {roles.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery-mode" className="text-[var(--foreground)]">Password delivery</Label>
              <select id="delivery-mode" value={form.deliveryMode} onChange={(event) => setForm((current) => ({ ...current, deliveryMode: event.target.value as "email" | "temp-password" }))} className="h-8 w-full rounded-lg border border-[var(--gray-border)] bg-[var(--surface-mid)] px-2.5 text-sm text-[var(--foreground)]">
                {canEmailUsers && <option value="email">Email reset link</option>}
                <option value="temp-password">Temporary password</option>
              </select>
            </div>
            <div className="md:col-span-2 flex items-center justify-end">
              <Button type="submit" className="bg-[var(--accent)] text-[var(--primary-foreground)] hover:bg-[var(--accent)]/80">Create user</Button>
            </div>
          </form>
          {tempPassword && (
            <p className="mt-4 rounded-lg border border-[var(--gray-border)] bg-[var(--surface-mid)] p-3 text-sm text-[var(--foreground)]">
              Temporary password: <span className="font-mono">{tempPassword}</span>
            </p>
          )}
          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        </CardContent>
      </Card>

      <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]">
        <CardHeader>
          <CardTitle className="text-[var(--foreground)]">Current users</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.userId}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-[var(--foreground)]">{user.displayName}</p>
                      <p className="text-xs text-[var(--text-dim)]">{user.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <select value={user.role} onChange={(event) => void handleRoleChange(user.userId, event.target.value as AppUser["role"])} className="h-8 rounded-lg border border-[var(--gray-border)] bg-[var(--surface-mid)] px-2.5 text-sm text-[var(--foreground)]">
                      {roles.map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
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
                  <TableCell className="text-[var(--text-dim)] text-sm">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {canEmailUsers && (
                        <Button variant="outline" size="sm" className="border-[var(--gray-border)] text-[var(--foreground)]" onClick={() => void handleResetPassword(user.userId, "email")}>Email reset</Button>
                      )}
                      <Button variant="outline" size="sm" className="border-[var(--gray-border)] text-[var(--foreground)]" onClick={() => void handleResetPassword(user.userId, "temp-password")}>Temp password</Button>
                      <Button variant="outline" size="sm" className="border-red-500/50 text-red-400" onClick={() => void handleDelete(user.userId)}>Delete</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
