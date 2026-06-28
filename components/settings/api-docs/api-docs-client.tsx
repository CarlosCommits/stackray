"use client"

import type {
  ApiDocsContent,
  ApiKeyEndpoint,
  ApiKeyManagementSection,
  AuthenticationSection,
  ConceptsSection,
  EndpointSection,
  ErrorHandlingSection,
  QuickStartSection,
} from "@/lib/api-docs/content"
import { ApiDocsCopyButton } from "./api-docs-copy-button"
import { serializeToMarkdown, serializeToPlainText } from "@/lib/api-docs/serializers"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface ApiDocsClientProps {
  content: ApiDocsContent
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--gray-border)] bg-[var(--surface-mid)] p-3">
      <code className="whitespace-pre text-xs font-mono text-[var(--foreground)]">{children}</code>
    </div>
  )
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--gray-border)] bg-[var(--surface-mid)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--text-dim)]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[var(--foreground)]">{value}</p>
    </div>
  )
}

function ExampleBlock({ label, code }: { label: string; code: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-[var(--accent)]">{label}</p>
      <CodeBlock>{code}</CodeBlock>
    </div>
  )
}

function renderInlineCode(text: string) {
  const parts = text.split(/(`[^`]+`)/g)
  const seen = new Map<string, number>()

  return parts.map((part) => {
    const count = (seen.get(part) ?? 0) + 1
    seen.set(part, count)
    const key = `${part}-${count}`

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={key} className="text-[var(--foreground)]">
          {part.slice(1, -1)}
        </code>
      )
    }

    return <span key={key}>{part}</span>
  })
}

function EndpointCard({ section }: { section: EndpointSection }) {
  return (
    <Card className="border-[var(--gray-border)] bg-[var(--surface-dark)]">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg text-[var(--foreground)]">{section.title}</CardTitle>
          <span className="rounded-full border border-[var(--gray-border)] px-2 py-0.5 text-[10px] font-mono text-[var(--accent)]">
            {section.method} {section.path}
          </span>
        </div>
        <CardDescription className="text-[var(--text-dim)]">{section.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ExampleBlock label="curl" code={section.curlExample} />
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--accent)]">
            {section.isSSE ? "Event stream response" : "Response"}
          </p>
          <CodeBlock>{section.responseExample}</CodeBlock>
        </div>
        <ul className="space-y-1 text-xs text-[var(--text-dim)]">
          {section.notes.map((note) => (
            <li key={note}>• {note}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function QuickStartCard({ section }: { section: QuickStartSection }) {
  return (
    <Card className="border-[var(--gray-border)] bg-[var(--surface-dark)]">
      <CardHeader>
        <CardTitle className="text-lg text-[var(--foreground)]">{section.title}</CardTitle>
        <CardDescription className="text-[var(--text-dim)]">{section.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="space-y-3 text-sm text-[var(--text-dim)]">
          {section.steps.map((step, index) => (
            <li key={step}>{index + 1}. {renderInlineCode(step)}</li>
          ))}
        </ol>
        <CodeBlock>{section.example}</CodeBlock>
      </CardContent>
    </Card>
  )
}

function AuthenticationCard({ section }: { section: AuthenticationSection }) {
  return (
    <Card className="border-[var(--gray-border)] bg-[var(--surface-dark)]">
      <CardHeader>
        <CardTitle className="text-lg text-[var(--foreground)]">{section.title}</CardTitle>
        <CardDescription className="text-[var(--text-dim)]">{section.description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {section.modes.map((mode) => (
          <div key={mode.title} className="space-y-2 rounded-lg border border-[var(--gray-border)] bg-[var(--surface-mid)] p-4">
            <p className="text-sm font-medium text-[var(--foreground)]">{mode.title}</p>
            <p className="text-xs text-[var(--text-dim)]">{mode.description}</p>
            <CodeBlock>{mode.example}</CodeBlock>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ConceptsCard({ section }: { section: ConceptsSection }) {
  return (
    <Card className="border-[var(--gray-border)] bg-[var(--surface-dark)]">
      <CardHeader>
        <CardTitle className="text-lg text-[var(--foreground)]">{section.title}</CardTitle>
        <CardDescription className="text-[var(--text-dim)]">{section.description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {section.items.map((item) => (
          <div key={item.term} className="rounded-lg border border-[var(--gray-border)] bg-[var(--surface-mid)] p-4">
            <p className="text-sm font-medium text-[var(--foreground)]">{item.term}</p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-dim)]">{item.description}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ApiKeyEndpointCard({
  method,
  path,
  description,
  responseExample,
}: ApiKeyEndpoint) {
  return (
    <div className="rounded-lg border border-[var(--gray-border)] bg-[var(--surface-mid)] p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-[var(--foreground)]">{method} {path}</p>
        <p className="mt-1 text-xs text-[var(--text-dim)]">{description}</p>
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-medium text-[var(--text-dim)] uppercase tracking-wide">Response</p>
        <CodeBlock>{responseExample}</CodeBlock>
      </div>
    </div>
  )
}

function ApiKeyManagementCard({ section }: { section: ApiKeyManagementSection }) {
  return (
    <Card className="border-[var(--gray-border)] bg-[var(--surface-dark)]">
      <CardHeader>
        <CardTitle className="text-lg text-[var(--foreground)]">{section.title}</CardTitle>
        <CardDescription className="text-[var(--text-dim)]">{section.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          {section.endpoints.map((endpoint) => (
            <ApiKeyEndpointCard key={`${endpoint.method}-${endpoint.path}`} {...endpoint} />
          ))}
        </div>
        <CodeBlock>{section.note}</CodeBlock>
      </CardContent>
    </Card>
  )
}

function ErrorHandlingCard({ section }: { section: ErrorHandlingSection }) {
  return (
    <Card className="border-[var(--gray-border)] bg-[var(--surface-dark)]">
      <CardHeader>
        <CardTitle className="text-lg text-[var(--foreground)]">{section.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <CodeBlock>{section.sampleError}</CodeBlock>
        <div className="grid gap-2 text-xs text-[var(--text-dim)] md:grid-cols-2">
          {section.codes.map((code) => (
            <p key={code.code}><code className="text-[var(--foreground)]">{code.code}</code>: {code.description}</p>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function ApiDocsClient({ content }: ApiDocsClientProps) {
  const markdownContent = serializeToMarkdown(content)
  const plainTextContent = serializeToPlainText(content)

  return (
    <div className="flex-1 min-w-0" data-docs-content="true">
      <div className="flex justify-end mb-4">
        <ApiDocsCopyButton
          markdownContent={markdownContent}
          plainTextContent={plainTextContent}
        />
      </div>
      <div className="space-y-6">
        {content.sections.map((section) => {
          switch (section.kind) {
            case "intro":
              return (
                <section key={section.id} id={section.id} className="scroll-mt-24">
                  <Card className="border-[var(--gray-border)] bg-[var(--surface-dark)]">
                    <CardHeader>
                      <CardTitle className="text-lg text-[var(--foreground)]">{section.title}</CardTitle>
                      <CardDescription className="text-[var(--text-dim)]">{section.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-3">
                      <InfoPill label="Base path" value={section.basePath} />
                      <InfoPill label="Primary auth" value={section.primaryAuth} />
                      <InfoPill label="Streaming" value={section.streaming} />
                    </CardContent>
                  </Card>
                </section>
              )
            case "quick-start":
              return (
                <section key="quick-start" id="quick-start" className="scroll-mt-24">
                  <QuickStartCard section={section} />
                </section>
              )
            case "authentication":
              return (
                <section key="authentication" id="authentication" className="scroll-mt-24">
                  <AuthenticationCard section={section} />
                </section>
              )
            case "concepts":
              return (
                <section key="concepts" id="concepts" className="scroll-mt-24">
                  <ConceptsCard section={section} />
                </section>
              )
            case "endpoint":
              return (
                <section key={section.id} id={section.id} className="scroll-mt-24">
                  <EndpointCard section={section} />
                </section>
              )
            case "api-key-management":
              return (
                <section key="api-key-management" id="api-key-management" className="scroll-mt-24">
                  <ApiKeyManagementCard section={section} />
                </section>
              )
            case "error-handling":
              return (
                <section key="error-handling" id="error-handling" className="scroll-mt-24">
                  <ErrorHandlingCard section={section} />
                </section>
              )
            case "api-key-access-disabled":
              return (
                <Card key="api-key-access-disabled" className="border-[var(--gray-border)] bg-[var(--surface-dark)]">
                  <CardHeader>
                    <CardTitle className="text-lg text-[var(--foreground)]">{section.title}</CardTitle>
                    <CardDescription className="text-[var(--text-dim)]">{section.description}</CardDescription>
                  </CardHeader>
                </Card>
              )
            default:
              return null
          }
        })}
      </div>
    </div>
  )
}
