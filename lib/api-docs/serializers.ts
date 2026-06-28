import type { ApiDocsContent } from "./content"

function escapeCodeBlock(text: string) {
  return text.replace(/```/g, "\\```")
}

function sectionToMarkdown(section: ApiDocsContent["sections"][number], indent = ""): string {
  switch (section.kind) {
    case "intro":
      return `${indent}## ${section.title}

${indent}${section.description}

${indent}| Base path | Primary auth | Streaming |
${indent}| --- | --- | --- |
${indent}| ${section.basePath} | ${section.primaryAuth} | ${section.streaming} |`
    case "quick-start":
      return `${indent}## ${section.title}

${indent}${section.description}

${section.steps.map((step, index) => `${indent}${index + 1}. ${step}`).join("\n")}

${indent}__CODE_FENCE__bash
${escapeCodeBlock(section.example)}
${indent}__CODE_FENCE__`.replaceAll("__CODE_FENCE__", "```")
    case "authentication":
      return `${indent}## ${section.title}

${indent}${section.description}

${section.modes.map((mode) => `${indent}### ${mode.title}

${indent}${mode.description}

${indent}__CODE_FENCE__
${escapeCodeBlock(mode.example)}
${indent}__CODE_FENCE__`.replaceAll("__CODE_FENCE__", "```" )).join("\n\n")}`
    case "concepts":
      return `${indent}## ${section.title}

${indent}${section.description}

${section.items.map((item) => `${indent}### ${item.term}

${indent}${item.description}`).join("\n\n")}`
    case "endpoint":
      return `${indent}## ${section.title}

${indent}${section.description}

${indent}**${section.method} ${section.path}**

${indent}### curl

${indent}__CODE_FENCE__bash
${escapeCodeBlock(section.curlExample)}
${indent}__CODE_FENCE__

${indent}### ${section.isSSE ? "Event stream response" : "Response"}

${indent}__CODE_FENCE__json
${escapeCodeBlock(section.responseExample)}
${indent}__CODE_FENCE__

${indent}${section.notes.map((n) => `- ${n}`).join("\n")}`.replaceAll("__CODE_FENCE__", "```")
    case "api-key-management":
      return `${indent}## ${section.title}

${indent}${section.description}

${section.endpoints.map((endpoint) => `${indent}### ${endpoint.method} ${endpoint.path}

${indent}${endpoint.description}

${indent}__CODE_FENCE__json
${escapeCodeBlock(endpoint.responseExample)}
${indent}__CODE_FENCE__`.replaceAll("__CODE_FENCE__", "```" )).join("\n\n")}

${indent}${section.note}`
    case "error-handling":
      return `${indent}## ${section.title}

${indent}__CODE_FENCE__json
${escapeCodeBlock(section.sampleError)}
${indent}__CODE_FENCE__

${indent}| Code | Description |
${indent}| --- | --- |
${section.codes.map((code) => `${indent}| \`${code.code}\` | ${code.description} |`).join("\n")}`.replaceAll("__CODE_FENCE__", "```")
    case "api-key-access-disabled":
      return `${indent}## ${section.title}

${indent}${section.description}`
  }
}

export function serializeToMarkdown(content: ApiDocsContent): string {
  const lines: string[] = [
    "# Stackray API Documentation",
    "",
    content.sections[0]?.kind === "intro" ? content.sections[0].description : "",
    "",
  ]

  for (const section of content.sections) {
    const markdown = sectionToMarkdown(section)
    if (markdown) {
      lines.push(markdown, "")
    }
  }

  return lines.join("\n").trim() + "\n"
}

function sectionToPlainText(section: ApiDocsContent["sections"][number], indent = ""): string {
  switch (section.kind) {
    case "intro":
      return `${indent}${section.title.toUpperCase()}\n${indent}${section.description}\n\n${indent}Base path: ${section.basePath}\n${indent}Primary auth: ${section.primaryAuth}\n${indent}Streaming: ${section.streaming}`
    case "quick-start":
      return `${indent}${section.title.toUpperCase()}\n\n${indent}${section.description}\n\n${section.steps.map((step, index) => `${indent}${index + 1}. ${step.replace(/`/g, "")}`).join("\n")}\n\n${indent}${section.example}`
    case "authentication":
      return `${indent}${section.title.toUpperCase()}\n\n${indent}${section.description}\n\n${section.modes.map((mode) => `${indent}${mode.title.toUpperCase()}\n${indent}${mode.description}\n\n${indent}${mode.example}`).join("\n\n")}`
    case "concepts":
      return `${indent}${section.title.toUpperCase()}\n\n${indent}${section.description}\n\n${section.items.map((item) => `${indent}${item.term}: ${item.description}`).join("\n")}`
    case "endpoint":
      return `${indent}${section.title.toUpperCase()}\n\n${indent}${section.description}\n\n${indent}${section.method} ${section.path}\n\n${indent}CURL:\n${indent}${section.curlExample}\n\n${indent}${section.isSSE ? "EVENT STREAM RESPONSE" : "RESPONSE"}:\n${indent}${section.responseExample}\n\n${indent}${section.notes.map((n) => `- ${n}`).join("\n")}`
    case "api-key-management":
      return `${indent}${section.title.toUpperCase()}\n\n${indent}${section.description}\n\n${section.endpoints.map((endpoint) => `${indent}${endpoint.method} ${endpoint.path}\n${indent}${endpoint.description}\n${indent}${endpoint.responseExample}`).join("\n\n")}\n\n${indent}${section.note}`
    case "error-handling":
      return `${indent}${section.title.toUpperCase()}\n\n${indent}${section.sampleError}\n\n${indent}Error codes:\n${section.codes.map((code) => `${indent}- ${code.code}: ${code.description}`).join("\n")}`
    case "api-key-access-disabled":
      return `${indent}${section.title.toUpperCase()}\n\n${indent}${section.description}`
  }
}

export function serializeToPlainText(content: ApiDocsContent): string {
  const lines: string[] = [
    "STACKRAY API DOCUMENTATION",
    "",
    content.sections[0]?.kind === "intro" ? content.sections[0].description : "",
    "",
  ]

  for (const section of content.sections) {
    const text = sectionToPlainText(section)
    if (text) {
      lines.push(text, "")
    }
  }

  return lines.join("\n").trim() + "\n"
}
