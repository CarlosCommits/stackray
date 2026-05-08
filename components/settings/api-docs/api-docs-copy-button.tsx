"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Copy, Check, FileText, Braces } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type CopyFormat = "markdown" | "text"

interface ApiDocsCopyButtonProps {
  markdownContent: string
  plainTextContent: string
}

export function ApiDocsCopyButton({
  markdownContent,
  plainTextContent,
}: ApiDocsCopyButtonProps) {
  const [open, setOpen] = useState(false)
  const [copiedFormat, setCopiedFormat] = useState<CopyFormat | null>(null)
  const resetCopiedFormatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (resetCopiedFormatTimeoutRef.current) {
        clearTimeout(resetCopiedFormatTimeoutRef.current)
      }
    }
  }, [])

  const handleCopy = useCallback(
    async (format: CopyFormat) => {
      const content = format === "markdown" ? markdownContent : plainTextContent
      await navigator.clipboard.writeText(content)
      if (resetCopiedFormatTimeoutRef.current) {
        clearTimeout(resetCopiedFormatTimeoutRef.current)
      }
      setCopiedFormat(format)
      setOpen(false)
      resetCopiedFormatTimeoutRef.current = setTimeout(() => {
        setCopiedFormat(null)
        resetCopiedFormatTimeoutRef.current = null
      }, 2000)
    },
    [markdownContent, plainTextContent]
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-[var(--gray-border)] text-[var(--foreground)]"
        >
          {copiedFormat ? (
            <>
              <Check className="size-3.5" data-icon="inline-start" />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" data-icon="inline-start" />
              Copy docs
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={4}
        className="flex flex-col gap-1 p-1.5 w-48"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <button
          type="button"
          onClick={() => void handleCopy("markdown")}
          className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-mid)] transition-colors cursor-pointer w-full text-left"
        >
          <Braces className="size-4 text-[var(--text-dim)]" />
          <span>Copy as Markdown</span>
        </button>
        <button
          type="button"
          onClick={() => void handleCopy("text")}
          className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-mid)] transition-colors cursor-pointer w-full text-left"
        >
          <FileText className="size-4 text-[var(--text-dim)]" />
          <span>Copy as Text</span>
        </button>
      </PopoverContent>
    </Popover>
  )
}
