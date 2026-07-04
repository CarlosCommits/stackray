"use client"

import { cn } from "@/lib/utils"

type MarkdownBlock =
  | { id: string; type: "heading"; level: 2 | 3 | 4; text: string }
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "ul"; items: string[] }
  | { id: string; type: "ol"; items: string[] }

function isBlockStart(line: string) {
  return /^(#{2,4})\s+/.test(line) || /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)
}

function parseBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.split(/\r?\n/)
  const blocks: MarkdownBlock[] = []

  for (let index = 0; index < lines.length;) {
    const rawLine = lines[index] ?? ""
    const line = rawLine.trimEnd()
    const trimmed = line.trim()

    if (!trimmed || /^<\/?[a-z][\s\S]*>$/i.test(trimmed)) {
      index += 1
      continue
    }

    const heading = trimmed.match(/^(#{2,4})\s+(.+)$/)
    if (heading) {
      blocks.push({
        id: `heading-${index}-${heading[2]}`,
        type: "heading",
        level: heading[1]!.length as 2 | 3 | 4,
        text: heading[2]!,
      })
      index += 1
      continue
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const startIndex = index
      const items: string[] = []

      while (index < lines.length) {
        const item = (lines[index] ?? "").trim().match(/^[-*]\s+(.+)$/)
        if (!item) {
          break
        }

        items.push(item[1]!)
        index += 1
      }

      blocks.push({ id: `ul-${startIndex}-${items[0] ?? ""}`, type: "ul", items })
      continue
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const startIndex = index
      const items: string[] = []

      while (index < lines.length) {
        const item = (lines[index] ?? "").trim().match(/^\d+\.\s+(.+)$/)
        if (!item) {
          break
        }

        items.push(item[1]!)
        index += 1
      }

      blocks.push({ id: `ol-${startIndex}-${items[0] ?? ""}`, type: "ol", items })
      continue
    }

    const startIndex = index
    const paragraphLines: string[] = []

    while (index < lines.length) {
      const paragraphLine = (lines[index] ?? "").trim()

      if (!paragraphLine || isBlockStart(paragraphLine)) {
        break
      }

      if (!/^<\/?[a-z][\s\S]*>$/i.test(paragraphLine)) {
        paragraphLines.push(paragraphLine)
      }
      index += 1
    }

    if (paragraphLines.length > 0) {
      const text = paragraphLines.join(" ")
      blocks.push({ id: `paragraph-${startIndex}-${text}`, type: "paragraph", text })
    }
  }

  return blocks
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []

  for (let index = 0; index < text.length;) {
    const link = text.slice(index).match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/)
    if (link) {
      nodes.push(
        <a
          key={`link-${index}-${link[2]}`}
          href={link[2]}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-[var(--accent)] underline decoration-[var(--accent)]/35 underline-offset-2 hover:text-[var(--accent)]/80"
        >
          {link[1]}
        </a>,
      )
      index += link[0].length
      continue
    }

    const strong = text.slice(index).match(/^\*\*([^*]+)\*\*/)
    if (strong) {
      nodes.push(
        <strong key={`strong-${index}-${strong[1]}`} className="font-semibold text-[var(--foreground)]">
          {strong[1]}
        </strong>,
      )
      index += strong[0].length
      continue
    }

    const code = text.slice(index).match(/^`([^`]+)`/)
    if (code) {
      nodes.push(
        <code
          key={`code-${index}-${code[1]}`}
          className="rounded border border-[var(--gray-border)] bg-[var(--surface-dark)] px-1 py-0.5 font-mono text-[0.9em] text-[var(--foreground)]"
        >
          {code[1]}
        </code>,
      )
      index += code[0].length
      continue
    }

    const nextSpecialIndexes = ["[", "**", "`"]
      .map((token) => text.indexOf(token, index))
      .filter((nextIndex) => nextIndex >= 0)
    const nextIndex = nextSpecialIndexes.length > 0 ? Math.min(...nextSpecialIndexes) : text.length
    const endIndex = nextIndex === index ? index + 1 : nextIndex

    nodes.push(text.slice(index, endIndex))
    index = endIndex
  }

  return nodes
}

interface ReleaseNotesMarkdownProps {
  markdown: string
  scrollable?: boolean
}

export function ReleaseNotesMarkdown({ markdown, scrollable = true }: ReleaseNotesMarkdownProps) {
  const blocks = parseBlocks(markdown)

  return (
    <div
      className={cn(
        "rounded-md border border-[var(--gray-border)] bg-[var(--surface-mid)] p-3 text-sm leading-6 text-[var(--text-dim)]",
        scrollable && "max-h-72 overflow-y-auto",
      )}
    >
      <div className="space-y-3">
        {blocks.map((block) => {
          if (block.type === "heading") {
            const className =
              block.level === 2
                ? "text-base font-semibold text-[var(--foreground)]"
                : "text-sm font-semibold text-[var(--foreground)]"

            return (
              <p key={block.id} className={className}>
                {renderInlineMarkdown(block.text)}
              </p>
            )
          }

          if (block.type === "ul") {
            return (
              <ul key={block.id} className="list-disc space-y-1 pl-5">
                {block.items.map((item, itemIndex) => (
                  <li key={`${block.id}-${itemIndex}-${item}`}>{renderInlineMarkdown(item)}</li>
                ))}
              </ul>
            )
          }

          if (block.type === "ol") {
            return (
              <ol key={block.id} className="list-decimal space-y-1 pl-5">
                {block.items.map((item, itemIndex) => (
                  <li key={`${block.id}-${itemIndex}-${item}`}>{renderInlineMarkdown(item)}</li>
                ))}
              </ol>
            )
          }

          return <p key={block.id}>{renderInlineMarkdown(block.text)}</p>
        })}
      </div>
    </div>
  )
}
