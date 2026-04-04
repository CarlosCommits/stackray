interface RunsPageHeaderProps {
  title: string
}

export function RunsPageHeader({ title }: RunsPageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="font-[var(--font-heading)] text-lg font-semibold text-[var(--foreground)]">
        {title}
      </h2>
    </div>
  )
}
