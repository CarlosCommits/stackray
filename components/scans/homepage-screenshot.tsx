import Image from "next/image"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Monitor } from "lucide-react"

interface HomepageScreenshotProps {
  target: string
  screenshot: {
    available: boolean
    path: string | null
    contentType: string | null
    byteSize: number | null
    capturedAt: string | null
  }
}

function formatByteSize(byteSize: number | null) {
  if (byteSize === null) {
    return null
  }

  if (byteSize < 1024) {
    return `${byteSize} B`
  }

  if (byteSize < 1024 * 1024) {
    return `${Math.round(byteSize / 1024)} KB`
  }

  return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`
}

export function HomepageScreenshot({ target, screenshot }: HomepageScreenshotProps) {
  const formattedSize = formatByteSize(screenshot.byteSize)
  const formattedCapturedAt = screenshot.capturedAt ? new Date(screenshot.capturedAt).toLocaleString() : null

  return (
    <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20 shadow-none overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--gray-border)]/20 bg-[var(--surface-mid)]/30">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-[var(--accent)]/10">
            <Monitor className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-[var(--foreground)]">Homepage Screenshot</CardTitle>
            <CardDescription className="text-xs text-[var(--text-dim)]">Headless capture of the final landing page</CardDescription>
          </div>
        </div>
        {screenshot.available ? (
          <Badge variant="outline" className="border-[var(--accent)]/30 text-[var(--accent)] text-xs">
            available
          </Badge>
        ) : null}
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {screenshot.available && screenshot.path ? (
          <>
            <div className="overflow-hidden rounded-lg border border-[var(--gray-border)]/20 bg-[var(--gray-charcoal)]/60">
              <Image
                src={screenshot.path}
                alt={`Homepage screenshot for ${target}`}
                width={1280}
                height={720}
                unoptimized
                className="h-auto w-full object-cover"
              />
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-[var(--text-dim)]">
              {formattedSize ? <span>Size: {formattedSize}</span> : null}
              {formattedCapturedAt ? <span>Captured: {formattedCapturedAt}</span> : null}
              {screenshot.contentType ? <span>Type: {screenshot.contentType}</span> : null}
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-[var(--gray-border)]/30 bg-[var(--gray-charcoal)]/40 px-4 py-8 text-center text-sm text-[var(--text-dim)]">
            Screenshot capture is not available for this result yet.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
