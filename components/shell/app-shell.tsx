import { Sidebar } from "./sidebar"
import { Header } from "./header"

interface AppShellUser {
  displayName: string
  email: string
  image: string | null
  role: "admin" | "user" | "viewer"
}

interface AppShellProps {
  children: React.ReactNode
  showStatus?: boolean
  user?: AppShellUser
  canManageUsers?: boolean
}

export function AppShell({ children, showStatus, user, canManageUsers }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--gray-charcoal)]">
      <Sidebar user={user} canManageUsers={canManageUsers} />
      <main className="scanline-grid relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header showStatus={showStatus} />
        <div className="flex-1 overflow-y-auto">
          <div className="p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
