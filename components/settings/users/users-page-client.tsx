"use client"

import { useState, type SyntheticEvent, type WheelEvent } from "react"

import type { AppUser } from "@/lib/contracts/users"
import { DemoDeploymentCta, DemoDeploymentPrompt } from "@/components/demo/demo-deployment-cta"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalTrigger,
} from "@/components/ui/responsive-modal"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Separator } from "@/components/ui/separator"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Check, Copy, Info, KeyRound, Pencil, Plus, ShieldCheck, Trash2, TriangleAlert, UserPlus, Users } from "lucide-react"

const USER_LAST_LOGIN_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "numeric",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
})

function formatUserLastLogin(value: string) {
  return USER_LAST_LOGIN_FORMAT.format(new Date(value))
}

const roles: AppUser["role"][] = ["admin", "user", "viewer"]

type CreateUserFormState = {
  email: string
  displayName: string
  role: AppUser["role"]
  apiKeyAccessEnabled: boolean
  deliveryMode: "email" | "temp-password"
}

type EditUserFormState = {
  email: string
  displayName: string
  apiKeyAccessEnabled: boolean
}

function handleDrawerBodyWheel(event: WheelEvent<HTMLDivElement>) {
  const element = event.currentTarget

  if (element.scrollHeight <= element.clientHeight) {
    return
  }

  element.scrollTop += event.deltaY
  event.preventDefault()
  event.stopPropagation()
}

function TempPasswordBanner({ password, onCopy, copied }: { password: string; onCopy: () => void; copied: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-[var(--accent)]" />
            <p className="text-sm font-medium text-[var(--foreground)]">Temporary password created: copy it now</p>
          </div>
          <p className="text-xs text-[var(--text-dim)]">
            For security, this password will not be shown again. Share it with the user through a secure channel. They will have to change it the next time they sign in.
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

function HelpTooltip({ label, children }: { label: string; children: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex size-5 items-center justify-center rounded-full text-[var(--text-dim)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
          aria-label={label}
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={6}
        className="z-[70] w-[min(18rem,calc(100vw-2rem))] text-xs leading-relaxed text-[var(--foreground)]"
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}

function ApiKeyAccessBadge({ user }: { user: AppUser }) {
  if (user.role === "admin") {
    return (
      <Badge variant="outline" className="border-[var(--gray-border)] text-[var(--text-dim)]">
        Always enabled
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className={user.apiKeyAccessEnabled
        ? "border-emerald-500/40 text-emerald-300"
        : "border-[var(--gray-border)] text-[var(--text-dim)]"}
    >
      {user.apiKeyAccessEnabled ? "Enabled" : "Disabled"}
    </Badge>
  )
}

function PasswordChangeRequiredIndicator() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-amber-300 transition-colors hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
          aria-label="Password change required"
        >
          <TriangleAlert className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-64 text-xs leading-relaxed">
        This user must change their password the next time they sign in.
      </TooltipContent>
    </Tooltip>
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
    <ResponsiveModal open={open} onOpenChange={(nextOpen) => {
      if (isDeleting) {
        return
      }

      onOpenChange(nextOpen)
    }}>
      <ResponsiveModalContent
        mobileClassName="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
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
        <ResponsiveModalHeader className="px-0 pt-0 text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
          <ResponsiveModalTitle>Delete user</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Are you sure you want to delete &quot;{user?.displayName}&quot; ({user?.email})? This action cannot be undone.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <ResponsiveModalFooter className="flex-col-reverse px-0 pb-0 md:flex-row md:px-4 md:pb-4 md:pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void handleDelete()} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete permanently"}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}

function UserCreateDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  canEmailUsers,
  tempPassword,
  copied,
  error,
  isCreating,
  onSubmit,
  onCopyPassword,
  onCreateAnother,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: CreateUserFormState
  onFormChange: (form: CreateUserFormState) => void
  canEmailUsers: boolean
  tempPassword: string | null
  copied: boolean
  error: string | null
  isCreating: boolean
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void
  onCopyPassword: () => void
  onCreateAnother: () => void
}) {
  const isAdminRole = form.role === "admin"

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} drawerProps={{ repositionInputs: false }}>
      <ResponsiveModalTrigger asChild>
        <Button className="bg-[var(--accent)] text-[var(--primary-foreground)] hover:bg-[var(--accent)]/80">
          <UserPlus data-icon="inline-start" />
          Create user
        </Button>
      </ResponsiveModalTrigger>
      <ResponsiveModalContent
        desktopClassName="sm:max-w-md"
        mobileClassName="h-[96svh] overflow-hidden p-0 data-[vaul-drawer-direction=bottom]:!max-h-[96svh]"
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
        <ResponsiveModalHeader className="px-4 pb-2 pt-4 text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left md:px-0 md:pb-0 md:pt-0">
          <ResponsiveModalTitle>Create user</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Add a Stackray account and choose its access settings.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        {tempPassword ? (
          <div className="flex min-h-0 flex-1 flex-col gap-0 md:contents">
            <div
              data-vaul-no-drag
              onWheel={handleDrawerBodyWheel}
              className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-2 md:overflow-visible md:px-0 md:py-0"
            >
              <TempPasswordBanner
                password={tempPassword}
                onCopy={onCopyPassword}
                copied={copied}
              />
            </div>
            <ResponsiveModalFooter className="flex-col-reverse px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 md:flex-row md:px-4 md:pb-4 md:pt-4">
              <Button type="button" variant="outline" onClick={onCreateAnother}>
                <Plus data-icon="inline-start" />
                Create another
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </ResponsiveModalFooter>
          </div>
        ) : (
          <form id="create-user-form" className="flex min-h-0 flex-1 flex-col gap-0 md:contents" onSubmit={onSubmit}>
            <div
              data-vaul-no-drag
              onWheel={handleDrawerBodyWheel}
              className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-2 md:overflow-visible md:px-0 md:py-0"
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="user-email">Email</FieldLabel>
                  <Input
                    id="user-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => onFormChange({ ...form, email: event.target.value })}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="user-display-name">Display name</FieldLabel>
                  <Input
                    id="user-display-name"
                    value={form.displayName}
                    onChange={(event) => onFormChange({ ...form, displayName: event.target.value })}
                    required
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>Role</FieldLabel>
                    <Select
                      value={form.role}
                      onValueChange={(value) => {
                        const role = value as AppUser["role"]
                        onFormChange({
                          ...form,
                          role,
                          apiKeyAccessEnabled: role === "admin" ? true : form.apiKeyAccessEnabled,
                        })
                      }}
                    >
                      <SelectTrigger className="w-full" aria-label="Role">
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
                  </Field>
                  <Field>
                    <div className="flex items-center gap-1.5">
                      <FieldLabel>Password delivery</FieldLabel>
                      <HelpTooltip label="Password delivery explanation">
                        Choose whether Stackray emails a reset link or creates a temporary password for manual sharing.
                      </HelpTooltip>
                    </div>
                    <Select
                      value={form.deliveryMode}
                      onValueChange={(value) => onFormChange({ ...form, deliveryMode: value as "email" | "temp-password" })}
                    >
                      <SelectTrigger className="w-full" aria-label="Password delivery">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {canEmailUsers && <SelectItem value="email">Email reset link</SelectItem>}
                          <SelectItem value="temp-password">Temporary password</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-[var(--foreground)]">API key access</span>
                      <HelpTooltip label="API key access explanation">
                        Allows non-admin users to create and manage their own API keys. Admins always keep access enabled.
                      </HelpTooltip>
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-dim)]">
                      {isAdminRole ? "Always enabled for admins" : form.apiKeyAccessEnabled ? "Enabled" : "Disabled"}
                    </p>
                  </div>
                  <Switch
                    checked={isAdminRole || form.apiKeyAccessEnabled}
                    disabled={isAdminRole}
                    onCheckedChange={(checked) => onFormChange({ ...form, apiKeyAccessEnabled: checked })}
                    aria-label="API key access"
                  />
                </div>
              </FieldGroup>

              {error && <p aria-live="polite" className="text-sm text-red-400">{error}</p>}
            </div>

            <ResponsiveModalFooter className="flex-col-reverse px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 md:flex-row md:px-4 md:pb-4 md:pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Creating..." : "Create user"}
              </Button>
            </ResponsiveModalFooter>
          </form>
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}

function UserEditDialog({
  open,
  onOpenChange,
  user,
  currentUserId,
  form,
  onFormChange,
  canEmailUsers,
  tempPassword,
  passwordCopied,
  error,
  isSaving,
  resetPasswordMode,
  onSubmit,
  onResetPassword,
  onCopyPassword,
  demoMode,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: AppUser | null
  currentUserId: string
  form: EditUserFormState
  onFormChange: (form: EditUserFormState) => void
  canEmailUsers: boolean
  tempPassword: string | null
  passwordCopied: boolean
  error: string | null
  isSaving: boolean
  resetPasswordMode: "email" | "temp-password" | null
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void
  onResetPassword: (deliveryMode: "email" | "temp-password") => void
  onCopyPassword: () => void
  demoMode: boolean
}) {
  const isResettingPassword = resetPasswordMode !== null
  const isAdminRole = user?.role === "admin"
  const isCurrentUser = user?.userId === currentUserId

  return (
    <ResponsiveModal open={open} onOpenChange={(nextOpen) => {
      if (isSaving || isResettingPassword) {
        return
      }

      onOpenChange(nextOpen)
    }} drawerProps={{ repositionInputs: false }}>
      <ResponsiveModalContent
        desktopClassName="sm:max-w-md"
        mobileClassName="h-[96svh] overflow-hidden p-0 data-[vaul-drawer-direction=bottom]:!max-h-[96svh]"
        showCloseButton={!isSaving && !isResettingPassword}
        onEscapeKeyDown={(event) => {
          if (isSaving || isResettingPassword) {
            event.preventDefault()
          }
        }}
        onInteractOutside={(event) => {
          if (isSaving || isResettingPassword) {
            event.preventDefault()
          }
        }}
        onPointerDownOutside={(event) => {
          if (isSaving || isResettingPassword) {
            event.preventDefault()
          }
        }}
      >
        <ResponsiveModalHeader className="px-4 pb-2 pt-4 text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left md:px-0 md:pb-0 md:pt-0">
          <ResponsiveModalTitle>Edit user</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Update the account identity shown in Stackray and used for sign-in.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <form className="flex min-h-0 flex-1 flex-col gap-0 md:contents" onSubmit={onSubmit}>
          <div
            data-vaul-no-drag
            onWheel={handleDrawerBodyWheel}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-2 md:overflow-visible md:px-0 md:py-0"
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="edit-user-email">Email</FieldLabel>
                <Input
                  id="edit-user-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => onFormChange({ ...form, email: event.target.value })}
                  required
                  disabled={demoMode}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-user-display-name">Display name</FieldLabel>
                <Input
                  id="edit-user-display-name"
                  value={form.displayName}
                  onChange={(event) => onFormChange({ ...form, displayName: event.target.value })}
                  required
                  disabled={demoMode}
                />
              </Field>
            </FieldGroup>

            <Separator className="bg-[var(--gray-border)]/50" />

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-[var(--foreground)]">Password access</p>
                <p className="text-xs text-[var(--text-dim)]">
                  {isCurrentUser
                    ? "Use Account settings to change your own password."
                    : canEmailUsers
                    ? "Send a reset link or create a one-time temporary password that must be changed on next sign-in."
                    : "Create a one-time temporary password that must be changed on next sign-in."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canEmailUsers && !isCurrentUser && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!user || isSaving || isResettingPassword || demoMode}
                    onClick={() => onResetPassword("email")}
                  >
                    {resetPasswordMode === "email" ? "Sending..." : "Email reset link"}
                  </Button>
                )}
                {!isCurrentUser && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!user || isSaving || isResettingPassword || demoMode}
                    onClick={() => onResetPassword("temp-password")}
                  >
                    {resetPasswordMode === "temp-password" ? "Creating..." : "Create temporary password"}
                  </Button>
                )}
              </div>
              {tempPassword && (
                <TempPasswordBanner
                  password={tempPassword}
                  onCopy={onCopyPassword}
                  copied={passwordCopied}
                />
              )}
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-[var(--foreground)]">API key access</span>
                  <HelpTooltip label="API key access explanation">
                    Allows non-admin users to create and manage their own API keys. Admins always keep access enabled.
                  </HelpTooltip>
                </div>
                <p className="mt-1 text-xs text-[var(--text-dim)]">
                  {isAdminRole ? "Always enabled for admins" : form.apiKeyAccessEnabled ? "Enabled" : "Disabled"}
                </p>
              </div>
              <Switch
                checked={isAdminRole || form.apiKeyAccessEnabled}
                disabled={isAdminRole || !user || demoMode}
                onCheckedChange={(checked) => onFormChange({ ...form, apiKeyAccessEnabled: checked })}
                aria-label="API key access"
              />
            </div>

            {demoMode ? (
              <DemoDeploymentCta
                source="users_edit_dialog"
                description="User changes are disabled on this shared instance. Launch your own Stackray instance to update roles, reset passwords, and manage API key access."
              />
            ) : null}

            {error && <p aria-live="polite" className="text-sm text-red-400">{error}</p>}
          </div>

          <ResponsiveModalFooter className="flex-col-reverse px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 md:flex-row md:px-4 md:pb-4 md:pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving || isResettingPassword}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || isResettingPassword || !user || demoMode}>
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </ResponsiveModalFooter>
        </form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}

export function UsersPageClient({
  initialUsers,
  canEmailUsers,
  currentUserId,
  demoMode = false,
}: {
  initialUsers: AppUser[]
  canEmailUsers: boolean
  currentUserId: string
  demoMode?: boolean
}) {
  const [users, setUsers] = useState(initialUsers)
  const [pageError, setPageError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [resetTempPassword, setResetTempPassword] = useState<string | null>(null)
  const [createdTempPassword, setCreatedTempPassword] = useState<string | null>(null)
  const [resetPasswordCopied, setResetPasswordCopied] = useState(false)
  const [createdPasswordCopied, setCreatedPasswordCopied] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [resetPasswordMode, setResetPasswordMode] = useState<"email" | "temp-password" | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [demoDeploymentOpen, setDemoDeploymentOpen] = useState(false)
  const [userToEdit, setUserToEdit] = useState<AppUser | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null)
  const [form, setForm] = useState<CreateUserFormState>({
    email: "",
    displayName: "",
    role: "user" as AppUser["role"],
    apiKeyAccessEnabled: true,
    deliveryMode: canEmailUsers ? "email" : "temp-password",
  })
  const [editForm, setEditForm] = useState<EditUserFormState>({
    email: "",
    displayName: "",
    apiKeyAccessEnabled: true,
  })

  const resetCreateForm = () => {
    setForm({
      email: "",
      displayName: "",
      role: "user",
      apiKeyAccessEnabled: true,
      deliveryMode: canEmailUsers ? "email" : "temp-password",
    })
    setCreateError(null)
    setCreatedTempPassword(null)
    setCreatedPasswordCopied(false)
  }

  const refreshUsers = async () => {
    const response = await fetch("/api/v1/settings/users")
    const payload = await response.json()
    setUsers(payload.items ?? [])
  }

  const handleCreateUser = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (demoMode) {
      return
    }

    setCreateError(null)
    setCreatedTempPassword(null)
    setCreatedPasswordCopied(false)

    try {
      setIsCreating(true)
      const response = await fetch("/api/v1/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setCreateError(payload?.error?.message ?? "Unable to create the user.")
        return
      }

      setForm({
        email: "",
        displayName: "",
        role: "user",
        apiKeyAccessEnabled: true,
        deliveryMode: canEmailUsers ? "email" : "temp-password",
      })
      setCreatedTempPassword(payload.temporaryPassword ?? null)
      await refreshUsers()

      if (!payload.temporaryPassword) {
        setCreateDialogOpen(false)
      }
    } finally {
      setIsCreating(false)
    }
  }

  const handleRoleChange = async (userId: string, role: AppUser["role"]) => {
    if (demoMode) {
      return
    }

    setPageError(null)
    const existingUser = users.find((user) => user.userId === userId)
    const response = await fetch(`/api/v1/settings/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role,
        apiKeyAccessEnabled: role === "admin" ? true : existingUser?.apiKeyAccessEnabled,
      }),
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      setPageError(payload?.error?.message ?? "Unable to update the role.")
      return
    }

    setUsers((currentUsers) => currentUsers.map((user) => (user.userId === userId ? payload : user)))
  }

  const handleEditUser = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (demoMode) {
      return
    }

    if (!userToEdit) {
      return
    }

    const email = editForm.email.trim()
    const displayName = editForm.displayName.trim()
    setEditError(null)

    if (!email || !displayName) {
      setEditError("Email and display name are required.")
      return
    }

    try {
      setIsSavingEdit(true)
      const response = await fetch(`/api/v1/settings/users/${userToEdit.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          displayName,
          apiKeyAccessEnabled: userToEdit.role === "admin" ? true : editForm.apiKeyAccessEnabled,
        }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setEditError(payload?.error?.message ?? "Unable to update the user.")
        return
      }

      setUsers((currentUsers) => currentUsers.map((user) => (user.userId === userToEdit.userId ? payload : user)))
      setUserToEdit(null)
      setEditForm({ email: "", displayName: "", apiKeyAccessEnabled: true })
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleResetPassword = async (userId: string, deliveryMode: "email" | "temp-password") => {
    if (demoMode) {
      return
    }

    setPageError(null)
    setEditError(null)
    setResetTempPassword(null)
    setResetPasswordCopied(false)

    try {
      setResetPasswordMode(deliveryMode)
      const response = await fetch(`/api/v1/settings/users/${userId}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryMode }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setEditError(payload?.error?.message ?? "Unable to reset the password.")
        return
      }

      setResetTempPassword(payload.temporaryPassword ?? null)
      await refreshUsers()
    } finally {
      setResetPasswordMode(null)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (demoMode) {
      return false
    }

    setPageError(null)
    const response = await fetch(`/api/v1/settings/users/${userId}`, {
      method: "DELETE",
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      setPageError(payload?.error?.message ?? "Unable to delete the user.")
      return false
    }

    setUsers((currentUsers) => currentUsers.filter((user) => user.userId !== userId))
    return true
  }

  const handleCopyCreatedPassword = async () => {
    if (!createdTempPassword) {
      return
    }

    await navigator.clipboard.writeText(createdTempPassword)
    setCreatedPasswordCopied(true)
    window.setTimeout(() => setCreatedPasswordCopied(false), 2000)
  }

  const handleCopyResetPassword = async () => {
    if (!resetTempPassword) {
      return
    }

    await navigator.clipboard.writeText(resetTempPassword)
    setResetPasswordCopied(true)
    window.setTimeout(() => setResetPasswordCopied(false), 2000)
  }

  const handleCreateDialogOpenChange = (open: boolean) => {
    if (isCreating) {
      return
    }

    if (!open) {
      resetCreateForm()
    } else {
      setCreateError(null)
    }

    setCreateDialogOpen(open)
  }

  const openEditDialog = (user: AppUser) => {
    setEditError(null)
    setResetTempPassword(null)
    setResetPasswordCopied(false)
    setEditForm({
      email: user.email,
      displayName: user.displayName,
      apiKeyAccessEnabled: user.role === "admin" ? true : user.apiKeyAccessEnabled,
    })
    setUserToEdit(user)
  }

  const handleEditDialogOpenChange = (open: boolean) => {
    if (!open) {
      setUserToEdit(null)
      setEditError(null)
      setResetTempPassword(null)
      setResetPasswordCopied(false)
      setEditForm({ email: "", displayName: "", apiKeyAccessEnabled: true })
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex justify-end">
        {demoMode ? (
          <Button
            type="button"
            className="bg-[var(--accent)] text-[var(--primary-foreground)] hover:bg-[var(--accent)]/80"
            onClick={() => setDemoDeploymentOpen(true)}
          >
            <UserPlus data-icon="inline-start" />
            Create user
          </Button>
        ) : (
          <UserCreateDialog
            open={createDialogOpen}
            onOpenChange={handleCreateDialogOpenChange}
            form={form}
            onFormChange={setForm}
            canEmailUsers={canEmailUsers}
            tempPassword={createdTempPassword}
            copied={createdPasswordCopied}
            error={createError}
            isCreating={isCreating}
            onSubmit={handleCreateUser}
            onCopyPassword={() => void handleCopyCreatedPassword()}
            onCreateAnother={resetCreateForm}
          />
        )}
      </div>

      <Card className="w-full border-[var(--gray-border)] bg-[var(--surface-dark)]">
        <CardHeader className="border-b border-[var(--gray-border)]/70 pb-4">
          <CardTitle className="text-[var(--foreground)]">Current users</CardTitle>
          <CardDescription className="text-[var(--text-dim)]">
            Manage roles, API key access, password resets, and account removal.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {pageError && <p aria-live="polite" className="text-sm text-red-400">{pageError}</p>}
          <div className="flex flex-col gap-3 lg:hidden">
            {users.map((user) => (
              <div
                key={user.userId}
                className="rounded-lg border border-[var(--gray-border)] bg-[var(--surface-mid)]/45 p-3"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="truncate font-medium text-[var(--foreground)]">{user.displayName}</p>
                      {user.requiresPasswordChange && <PasswordChangeRequiredIndicator />}
                    </div>
                    <p className="truncate text-xs text-[var(--text-dim)]">{user.email}</p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="border-[var(--gray-border)] text-[var(--foreground)]"
                      onClick={() => openEditDialog(user)}
                      aria-label={`Edit ${user.displayName}`}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="border-red-500/40 text-red-400 hover:border-red-500/60 hover:bg-red-500/5"
                      onClick={() => setUserToDelete(user)}
                      disabled={demoMode || user.userId === currentUserId}
                      aria-label={`Delete ${user.displayName}`}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-[var(--gray-border)] text-[var(--text-dim)]">
                    {user.isActive ? "active" : "inactive"}
                  </Badge>
                </div>

                <div className="mt-4 grid gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-[var(--text-dim)]">Role</span>
                    <Select value={user.role} onValueChange={(value) => void handleRoleChange(user.userId, value as AppUser["role"])} disabled={demoMode || user.userId === currentUserId}>
                      <SelectTrigger className="h-8 w-28 border-[var(--gray-border)] bg-[var(--surface-dark)] text-[var(--foreground)]" aria-label={`Role for ${user.displayName}`}>
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

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-[var(--text-dim)]">API keys</span>
                    <ApiKeyAccessBadge user={user} />
                  </div>

                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-[var(--text-dim)]">Last login</span>
                    <span className="text-right text-[var(--foreground)]">
                      {user.lastLoginAt ? formatUserLastLogin(user.lastLoginAt) : "Never"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden lg:block">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-64 pr-8">Email</TableHead>
                  <TableHead className="w-px px-4">Role</TableHead>
                  <TableHead className="w-px px-4">Status</TableHead>
                  <TableHead className="w-px px-4">API keys</TableHead>
                  <TableHead className="w-px px-4">Last login</TableHead>
                  <TableHead className="w-px pl-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.userId}>
                    <TableCell className="min-w-64 max-w-[28rem] pr-8">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <p className="truncate font-medium text-[var(--foreground)]">{user.displayName}</p>
                          {user.requiresPasswordChange && <PasswordChangeRequiredIndicator />}
                        </div>
                        <p className="truncate text-xs text-[var(--text-dim)]">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="w-px px-4">
                      <Select value={user.role} onValueChange={(value) => void handleRoleChange(user.userId, value as AppUser["role"])} disabled={demoMode || user.userId === currentUserId}>
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
                    <TableCell className="w-px px-4">
                      <div className="flex gap-2">
                        <Badge variant="outline" className="border-[var(--gray-border)] text-[var(--text-dim)]">
                          {user.isActive ? "active" : "inactive"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="w-px px-4">
                      <ApiKeyAccessBadge user={user} />
                    </TableCell>
                    <TableCell className="w-px whitespace-nowrap px-4 text-[var(--text-dim)] text-sm">
                      {user.lastLoginAt ? formatUserLastLogin(user.lastLoginAt) : "Never"}
                    </TableCell>
                    <TableCell className="w-px pl-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="icon-sm"
                          className="border-[var(--gray-border)] text-[var(--foreground)]"
                          onClick={() => openEditDialog(user)}
                          aria-label={`Edit ${user.displayName}`}
                        >
                          <Pencil />
                        </Button>
                        <Button variant="outline" size="sm" className="border-red-500/40 text-red-400 hover:border-red-500/60 hover:bg-red-500/5" onClick={() => setUserToDelete(user)} disabled={demoMode || user.userId === currentUserId}>
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
      <UserEditDialog
        open={userToEdit !== null}
        onOpenChange={handleEditDialogOpenChange}
        user={userToEdit}
        currentUserId={currentUserId}
        form={editForm}
        onFormChange={setEditForm}
        canEmailUsers={canEmailUsers}
        tempPassword={resetTempPassword}
        passwordCopied={resetPasswordCopied}
        error={editError}
        isSaving={isSavingEdit}
        resetPasswordMode={resetPasswordMode}
        onSubmit={handleEditUser}
        onResetPassword={(deliveryMode) => {
          if (userToEdit) {
            void handleResetPassword(userToEdit.userId, deliveryMode)
          }
        }}
        onCopyPassword={() => void handleCopyResetPassword()}
        demoMode={demoMode}
      />
      <DemoDeploymentPrompt
        open={demoDeploymentOpen}
        onOpenChange={setDemoDeploymentOpen}
        source="users_create_dialog"
        title="User management needs your own deployment"
        description="User creation is disabled on this shared instance. Launch your own Stackray instance on Railway to invite teammates, manage roles, and control API key access."
        features={[
          { icon: Users, label: "Team user invites" },
          { icon: ShieldCheck, label: "Role management" },
          { icon: KeyRound, label: "Per-user API access" },
        ]}
      />
    </div>
  )
}
