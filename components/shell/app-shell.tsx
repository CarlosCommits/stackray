import { Sidebar } from "./sidebar"
import { Header } from "./header"

interface AppShellProps {
  children: React.ReactNode
  workspace?: string
  showStatus?: boolean
}

export function AppShell({ children, workspace, showStatus }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--gray-charcoal)]">
      <Sidebar />
      <main className="scanline-grid relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header workspace={workspace} showStatus={showStatus} />
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
