import { cn } from "@/lib/utils"

const FOUR_ITEMS = [0, 1, 2, 3] as const
const FIVE_ITEMS = [0, 1, 2, 3, 4] as const
const SIX_ITEMS = [0, 1, 2, 3, 4, 5] as const
const EIGHT_ITEMS = [0, 1, 2, 3, 4, 5, 6, 7] as const

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-md bg-[var(--surface-light)]/55 motion-safe:animate-pulse",
        className,
      )}
    />
  )
}

function LoadingStatus({ label, children, className }: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className} role="status" aria-label={label} aria-live="polite">
      {children}
      <span className="sr-only">{label}</span>
    </div>
  )
}

function PanelSkeleton({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "overflow-hidden rounded-lg border border-[var(--gray-border)] bg-[var(--surface-dark)] ring-1 ring-white/5",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function ListRouteLoadingSkeleton() {
  return (
    <LoadingStatus
      label="Loading page"
      className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5"
    >
      <div className="flex items-center justify-between gap-4">
        <SkeletonBlock className="h-7 w-36 sm:h-8 sm:w-48" />
        <SkeletonBlock className="h-9 w-24 sm:w-32" />
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        {FOUR_ITEMS.map((item) => (
          <PanelSkeleton key={item} className="h-20 sm:h-24">
            <div className="flex h-full flex-col justify-between p-3 sm:p-4">
              <SkeletonBlock className="h-3 w-16 sm:w-20" />
              <SkeletonBlock className="h-6 w-12 sm:h-7 sm:w-16" />
            </div>
          </PanelSkeleton>
        ))}
      </div>

      <PanelSkeleton>
        <div className="border-b border-[var(--gray-border)] p-3 sm:p-4">
          <div className="flex items-center gap-2.5">
            <SkeletonBlock className="h-9 min-w-0 flex-1 sm:max-w-sm" />
            <SkeletonBlock className="size-9 shrink-0 sm:w-28" />
          </div>
        </div>

        <div className="space-y-2.5 p-3 md:hidden" data-loading-viewport="mobile">
          {FIVE_ITEMS.map((item) => (
            <div
              key={item}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[var(--gray-border)]/65 bg-[var(--surface-mid)]/35 p-3"
            >
              <SkeletonBlock className="size-9 rounded-lg" />
              <div className="min-w-0 space-y-2">
                <SkeletonBlock className="h-4 w-3/5" />
                <div className="flex gap-2">
                  <SkeletonBlock className="h-3 w-16" />
                  <SkeletonBlock className="h-3 w-12" />
                </div>
              </div>
              <SkeletonBlock className="size-7" />
            </div>
          ))}
        </div>

        <div className="hidden md:block" data-loading-viewport="desktop">
          <div className="grid grid-cols-[minmax(14rem,1.4fr)_7rem_7rem_8rem_6rem] gap-4 border-b border-[var(--gray-border)] px-4 py-3">
            {FIVE_ITEMS.map((item) => (
              <SkeletonBlock key={item} className="h-3 w-3/5" />
            ))}
          </div>
          {SIX_ITEMS.map((item) => (
            <div
              key={item}
              className="grid min-h-14 grid-cols-[minmax(14rem,1.4fr)_7rem_7rem_8rem_6rem] items-center gap-4 border-b border-[var(--gray-border)]/45 px-4 last:border-b-0"
            >
              <div className="flex items-center gap-3">
                <SkeletonBlock className="size-8 shrink-0" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <SkeletonBlock className="h-3.5 w-2/5" />
                  <SkeletonBlock className="h-3 w-3/5" />
                </div>
              </div>
              <SkeletonBlock className="h-5 w-16" />
              <SkeletonBlock className="h-5 w-14" />
              <SkeletonBlock className="h-3.5 w-20" />
              <SkeletonBlock className="ml-auto h-7 w-14" />
            </div>
          ))}
        </div>
      </PanelSkeleton>
    </LoadingStatus>
  )
}

export function ScanDetailLoadingSkeleton() {
  return (
    <LoadingStatus label="Loading scan details" className="min-w-0 space-y-3">
      <PanelSkeleton className="p-3.5 sm:p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <SkeletonBlock className="size-11 shrink-0 rounded-lg sm:size-12" />
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonBlock className="h-5 w-44 max-w-full sm:h-6 sm:w-64" />
              <SkeletonBlock className="h-3.5 w-56 max-w-[85%] sm:w-80" />
            </div>
          </div>
          <div className="flex items-center gap-2 sm:justify-end">
            <SkeletonBlock className="h-7 w-24 rounded-full" />
            <SkeletonBlock className="h-7 w-20 rounded-full" />
          </div>
        </div>
      </PanelSkeleton>

      <PanelSkeleton className="p-3 sm:p-4">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8" data-loading-layout="scan-progress">
          {EIGHT_ITEMS.map((item) => (
            <div key={item} className={cn("space-y-2", item > 3 && "hidden sm:block")}>
              <div className="flex items-center gap-1.5">
                <SkeletonBlock className="size-5 shrink-0 rounded-full" />
                <SkeletonBlock className="h-1.5 min-w-0 flex-1 rounded-full" />
              </div>
              <SkeletonBlock className="h-2.5 w-12 max-w-full" />
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--gray-border)]/40 pt-3 sm:grid-cols-4">
          {FOUR_ITEMS.map((item) => (
            <div key={item} className="space-y-1.5">
              <SkeletonBlock className="h-2.5 w-14" />
              <SkeletonBlock className="h-4 w-20 max-w-full" />
            </div>
          ))}
        </div>
      </PanelSkeleton>

      <div
        aria-hidden="true"
        className="-mx-4 flex gap-2 overflow-hidden border-y border-[var(--gray-border)]/35 bg-[var(--surface-dark)]/85 px-4 py-2.5 sm:mx-0 sm:rounded-lg sm:border"
      >
        {["w-24", "w-24", "w-28", "w-24", "w-28"].map((width, index) => (
          <SkeletonBlock key={index} className={cn("h-6 shrink-0", width)} />
        ))}
      </div>

      <PanelSkeleton>
        <div className="grid gap-3 border-b border-[var(--gray-border)]/45 p-3 sm:grid-cols-[auto_minmax(12rem,18rem)_auto] sm:items-center sm:p-4">
          <SkeletonBlock className="h-3 w-32" />
          <SkeletonBlock className="h-10 w-full sm:h-9" />
          <SkeletonBlock className="h-9 w-24" />
        </div>
        <div className="columns-1 gap-3 p-3 sm:p-4 xl:columns-2">
          {FOUR_ITEMS.map((item) => (
            <div
              key={item}
              className="mb-3 inline-block w-full break-inside-avoid overflow-hidden rounded-lg border border-[var(--gray-border)]/55 bg-[var(--background)]/70"
            >
              <div className="flex items-center gap-2.5 border-b border-[var(--gray-border)]/45 p-3">
                <SkeletonBlock className="size-7 shrink-0" />
                <SkeletonBlock className="h-4 w-28" />
                <SkeletonBlock className="ml-auto h-5 w-8 rounded-full" />
              </div>
              <div className="divide-y divide-[var(--gray-border)]/35 px-3">
                {FOUR_ITEMS.slice(0, item % 2 === 0 ? 3 : 2).map((row) => (
                  <div key={row} className="flex items-center gap-2.5 py-3">
                    <SkeletonBlock className="size-7 shrink-0" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <SkeletonBlock className="h-3.5 w-2/5" />
                      <SkeletonBlock className="h-2.5 w-3/5 sm:hidden" />
                    </div>
                    <SkeletonBlock className="h-3 w-20" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PanelSkeleton>
    </LoadingStatus>
  )
}

function SettingsHeaderSkeleton({ withAction = true }: { withAction?: boolean }) {
  return withAction ? (
    <div className="flex justify-end">
      <SkeletonBlock className="h-9 w-32" />
    </div>
  ) : null
}

function SettingsCardHeaderSkeleton({ withIcon = false }: { withIcon?: boolean }) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--gray-border)]/70 p-4 sm:p-5">
      {withIcon ? <SkeletonBlock className="size-9 shrink-0 rounded-lg" /> : null}
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonBlock className="h-4 w-32" />
        <SkeletonBlock className="h-3 w-full max-w-md" />
      </div>
    </div>
  )
}

export function AccountSettingsLoadingSkeleton() {
  return (
    <LoadingStatus
      label="Loading account settings"
      className="mx-auto flex w-full max-w-3xl flex-col gap-5"
    >
      <PanelSkeleton>
        <SettingsCardHeaderSkeleton withIcon />
        <div className="space-y-5 p-4 sm:p-5">
          {FOUR_ITEMS.slice(0, 3).map((item) => (
            <div key={item} className="space-y-2">
              <SkeletonBlock className="h-3 w-32" />
              <SkeletonBlock className="h-10 w-full" />
              {item === 1 ? <SkeletonBlock className="h-3 w-44" /> : null}
            </div>
          ))}
          <div className="flex items-start gap-3 rounded-lg border border-[var(--gray-border)]/70 p-3.5">
            <SkeletonBlock className="h-5 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonBlock className="h-3.5 w-40" />
              <SkeletonBlock className="h-3 w-full max-w-md" />
            </div>
          </div>
          <div className="flex border-t border-[var(--gray-border)]/70 pt-5 sm:justify-end">
            <SkeletonBlock className="h-10 w-full sm:w-36" />
          </div>
        </div>
      </PanelSkeleton>
    </LoadingStatus>
  )
}

export function ApiKeysSettingsLoadingSkeleton() {
  return (
    <LoadingStatus
      label="Loading API keys"
      className="mx-auto flex w-full max-w-7xl flex-col gap-5 sm:gap-6"
    >
      <SettingsHeaderSkeleton />
      <div className="grid items-start gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <PanelSkeleton>
          <SettingsCardHeaderSkeleton />
          <div className="space-y-3 p-3 md:hidden" data-loading-viewport="mobile">
            {FOUR_ITEMS.map((item) => (
              <div key={item} className="rounded-lg border border-[var(--gray-border)]/60 bg-[var(--surface-mid)]/35 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <SkeletonBlock className="h-4 w-2/5" />
                    <SkeletonBlock className="h-3 w-4/5" />
                  </div>
                  <SkeletonBlock className="size-8 shrink-0" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <SkeletonBlock className="h-3 w-20" />
                  <SkeletonBlock className="ml-auto h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
          <div className="hidden md:block" data-loading-viewport="desktop">
            <div className="grid grid-cols-[minmax(14rem,1fr)_8rem_8rem_5rem] gap-4 border-b border-[var(--gray-border)] px-4 py-3">
              {FOUR_ITEMS.map((item) => <SkeletonBlock key={item} className="h-3 w-3/5" />)}
            </div>
            {FIVE_ITEMS.map((item) => (
              <div key={item} className="grid min-h-14 grid-cols-[minmax(14rem,1fr)_8rem_8rem_5rem] items-center gap-4 border-b border-[var(--gray-border)]/45 px-4 last:border-b-0">
                <div className="space-y-1.5">
                  <SkeletonBlock className="h-3.5 w-2/5" />
                  <SkeletonBlock className="h-3 w-3/5" />
                </div>
                <SkeletonBlock className="h-3 w-20" />
                <SkeletonBlock className="h-3 w-20" />
                <SkeletonBlock className="ml-auto size-8" />
              </div>
            ))}
          </div>
        </PanelSkeleton>

        <PanelSkeleton className="p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <SkeletonBlock className="size-8 shrink-0" />
            <SkeletonBlock className="h-4 w-32" />
          </div>
          <SkeletonBlock className="mt-3 h-3 w-full" />
          <div className="mt-5 space-y-4">
            {FOUR_ITEMS.slice(0, 3).map((item) => (
              <div key={item} className="flex items-start gap-2.5">
                <SkeletonBlock className="size-5 shrink-0" />
                <SkeletonBlock className="mt-1 h-3 min-w-0 flex-1" />
              </div>
            ))}
          </div>
          <SkeletonBlock className="mt-5 h-10 w-full" />
        </PanelSkeleton>
      </div>
    </LoadingStatus>
  )
}

export function UsersSettingsLoadingSkeleton() {
  return (
    <LoadingStatus
      label="Loading users"
      className="mx-auto flex w-full max-w-7xl flex-col gap-5 sm:gap-6"
    >
      <SettingsHeaderSkeleton />
      <PanelSkeleton>
        <SettingsCardHeaderSkeleton />
        <div className="space-y-3 p-3 lg:hidden" data-loading-viewport="mobile">
          {FOUR_ITEMS.map((item) => (
            <div key={item} className="rounded-lg border border-[var(--gray-border)] bg-[var(--surface-mid)]/35 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <SkeletonBlock className="h-4 w-2/5" />
                  <SkeletonBlock className="h-3 w-3/5" />
                </div>
                <div className="flex gap-1.5">
                  <SkeletonBlock className="size-8" />
                  <SkeletonBlock className="size-8" />
                </div>
              </div>
              <SkeletonBlock className="mt-3 h-5 w-16 rounded-full" />
              <div className="mt-4 space-y-3">
                {FOUR_ITEMS.slice(0, 3).map((row) => (
                  <div key={row} className="flex items-center justify-between gap-3">
                    <SkeletonBlock className="h-3 w-16" />
                    <SkeletonBlock className={cn("h-5", row === 0 ? "w-24" : "w-20")} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="hidden lg:block" data-loading-viewport="desktop">
          <div className="grid grid-cols-[minmax(16rem,1fr)_6rem_6rem_6rem_8rem_7rem] gap-4 border-b border-[var(--gray-border)] px-4 py-3">
            {SIX_ITEMS.map((item) => <SkeletonBlock key={item} className="h-3 w-3/5" />)}
          </div>
          {FIVE_ITEMS.map((item) => (
            <div key={item} className="grid min-h-16 grid-cols-[minmax(16rem,1fr)_6rem_6rem_6rem_8rem_7rem] items-center gap-4 border-b border-[var(--gray-border)]/45 px-4 last:border-b-0">
              <div className="space-y-1.5">
                <SkeletonBlock className="h-3.5 w-2/5" />
                <SkeletonBlock className="h-3 w-3/5" />
              </div>
              <SkeletonBlock className="h-8 w-20" />
              <SkeletonBlock className="h-5 w-14 rounded-full" />
              <SkeletonBlock className="h-5 w-16 rounded-full" />
              <SkeletonBlock className="h-3 w-20" />
              <SkeletonBlock className="ml-auto h-8 w-20" />
            </div>
          ))}
        </div>
      </PanelSkeleton>
    </LoadingStatus>
  )
}
