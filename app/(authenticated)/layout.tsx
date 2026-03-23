import { AppShell } from "@/components/shell"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppShell workspace="Workspace Alpha">
      {children}
    </AppShell>
  )
}
