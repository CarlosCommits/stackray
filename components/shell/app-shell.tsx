import { Sidebar } from "./sidebar"
import { Header } from "./header"

interface AppShellProps {
  children: React.ReactNode
  workspace?: string
  showStatus?: boolean
}

export function AppShell({ children, workspace, showStatus }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-[var(--gray-charcoal)]">
      <Sidebar />
      <main className="scanline-grid flex-1 flex flex-col relative overflow-auto">
        <Header workspace={workspace} showStatus={showStatus} />
        <div className="flex-1 p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
