import { describe, expect, it } from "vitest"
import { scanReportResponseSchema } from "@/lib/contracts/scans"
import { buildApiDocsContent } from "./content"
import { serializeToMarkdown, serializeToPlainText } from "./serializers"

describe("api-docs serializers", () => {
  describe("serializeToMarkdown", () => {
    it("uses the resolved public origin in examples when provided", () => {
      const content = buildApiDocsContent(true, "https://demo.stackray.example.test")
      const markdown = serializeToMarkdown(content)

      expect(markdown).toContain("https://demo.stackray.example.test")
      expect(markdown).not.toContain("https://your-stackray-instance.com")
    })

    it("generates markdown for intro section with API overview", () => {
      const content = buildApiDocsContent(true)
      const markdown = serializeToMarkdown(content)

      expect(markdown).toContain("# Stackray API Documentation")
      expect(markdown).toContain("## API docs")
      expect(markdown).toContain("| Base path | Primary auth | Streaming |")
      expect(markdown).toContain("| /api/v1 | Bearer API key | SSE events |")
    })

    it("generates markdown for quick-start section", () => {
      const content = buildApiDocsContent(true)
      const markdown = serializeToMarkdown(content)

      expect(markdown).toContain("## Quick start")
      expect(markdown).toContain("Start here if you just created an API key")
      expect(markdown).toContain("`/settings/api-keys`")
      expect(markdown).toContain("`GET /scans/:scanId/report`")
    })

    it("generates markdown for authentication section", () => {
      const content = buildApiDocsContent(true)
      const markdown = serializeToMarkdown(content)

      expect(markdown).toContain("## Authentication modes")
      expect(markdown).toContain("Bearer API key")
      expect(markdown).toContain("Browser session")
      expect(markdown).toContain("Product-resource endpoints accept either bearer API keys or browser sessions")
      expect(markdown).toContain("API key management, user administration, password changes")
      expect(markdown).toContain("Authorization: Bearer sr_live_your_api_key_here")
    })

    it("generates markdown for concepts section", () => {
      const content = buildApiDocsContent(true)
      const markdown = serializeToMarkdown(content)

      expect(markdown).toContain("## Concepts")
      expect(markdown).toContain("### scanId")
      expect(markdown).toContain("### resultId")
      expect(markdown).toContain("### target")
      expect(markdown).toContain("Most agents can start with the scan report")
    })

    it("generates markdown for endpoint sections", () => {
      const content = buildApiDocsContent(true)
      const markdown = serializeToMarkdown(content)

      expect(markdown).toContain("## Submit a scan")
      expect(markdown).toContain("**POST /scans**")
      expect(markdown).toContain("## Get primary technologies")
      expect(markdown).toContain("**GET /scans/:scanId/technologies**")
      expect(markdown).toContain("## Get the scan summary")
      expect(markdown).toContain("**GET /scans/:scanId/report**")
      expect(markdown).toContain("## Page through observed result rows")
      expect(markdown).toContain("## Page through subdomains")
      expect(markdown).toContain("## Advanced: technologies for one result row")
      expect(markdown).toContain("**GET /scans/:scanId/results/:resultId/technologies**")
      expect(markdown).toContain("## Advanced: target technology history")
      expect(markdown).toContain("**GET /targets/:canonicalTargetId/technologies**")
      expect(markdown).toContain("## List schedules")
      expect(markdown).toContain("**GET /schedules**")
      expect(markdown).toContain("## Create a schedule")
      expect(markdown).toContain("**POST /schedules**")
      expect(markdown).toContain("## Pause or resume a schedule")
      expect(markdown).toContain("**PATCH /schedules/:scheduleId**")
      expect(markdown).toContain("## Delete a schedule")
      expect(markdown).toContain("**DELETE /schedules/:scheduleId**")
      expect(markdown).toContain("### curl")
      expect(markdown).not.toContain("### JavaScript / TypeScript")
      expect(markdown).not.toContain("### Python")
      expect(markdown).toContain("### Response")
    })

    it("keeps the scan report response example aligned with the public contract", () => {
      const content = buildApiDocsContent(true)
      const reportSection = content.sections.find((section) => section.kind === "endpoint" && section.id === "scan-report")

      expect(reportSection?.kind).toBe("endpoint")
      if (reportSection?.kind !== "endpoint") {
        throw new Error("scan-report endpoint section is missing")
      }

      expect(() => scanReportResponseSchema.parse(JSON.parse(reportSection.responseExample))).not.toThrow()
    })

    it("generates markdown for SSE endpoint sections", () => {
      const content = buildApiDocsContent(true)
      const markdown = serializeToMarkdown(content)

      expect(markdown).toContain("## Watch progress")
      expect(markdown).toContain("### Event stream response")
    })

    it("generates markdown for API key management section", () => {
      const content = buildApiDocsContent(true)
      const markdown = serializeToMarkdown(content)

      expect(markdown).toContain("## API key management")
      expect(markdown).toContain("### GET /api-keys")
      expect(markdown).toContain("### POST /api-keys")
      expect(markdown).toContain("### DELETE /api-keys/:apiKeyId")
    })

    it("generates markdown for error handling section", () => {
      const content = buildApiDocsContent(true)
      const markdown = serializeToMarkdown(content)

      expect(markdown).toContain("## Error handling")
      expect(markdown).toContain("`invalid_api_key`")
      expect(markdown).toContain("`invalid_target`")
    })

    it("includes api-key-access-disabled section when API keys are disabled", () => {
      const content = buildApiDocsContent(false)
      const markdown = serializeToMarkdown(content)

      expect(markdown).toContain("## API key access is disabled for this account")
    })

    it("excludes api-key-access-disabled section when API keys are enabled", () => {
      const content = buildApiDocsContent(true)
      const markdown = serializeToMarkdown(content)

      expect(markdown).not.toContain("API key access is disabled")
    })
  })

  describe("serializeToPlainText", () => {
    it("generates plain text for intro section with API overview", () => {
      const content = buildApiDocsContent(true)
      const text = serializeToPlainText(content)

      expect(text).toContain("STACKRAY API DOCUMENTATION")
      expect(text).toContain("API DOCS")
      expect(text).toContain("Base path: /api/v1")
      expect(text).toContain("Primary auth: Bearer API key")
    })

    it("generates plain text for quick-start section", () => {
      const content = buildApiDocsContent(true)
      const text = serializeToPlainText(content)

      expect(text).toContain("QUICK START")
      expect(text).toContain("Start here if you just created an API key")
    })

    it("generates plain text for endpoint sections", () => {
      const content = buildApiDocsContent(true)
      const text = serializeToPlainText(content)

      expect(text).toContain("SUBMIT A SCAN")
      expect(text).toContain("POST /scans")
      expect(text).toContain("GET PRIMARY TECHNOLOGIES")
      expect(text).toContain("GET /scans/:scanId/technologies")
      expect(text).toContain("GET THE SCAN SUMMARY")
      expect(text).toContain("GET /scans/:scanId/report")
      expect(text).toContain("ADVANCED: TECHNOLOGIES FOR ONE RESULT ROW")
      expect(text).toContain("GET /scans/:scanId/results/:resultId/technologies")
      expect(text).toContain("ADVANCED: TARGET TECHNOLOGY HISTORY")
      expect(text).toContain("GET /targets/:canonicalTargetId/technologies")
      expect(text).toContain("SEARCH SCAN HISTORY")
      expect(text).toContain("GET /schedules")
      expect(text).toContain("CREATE A SCHEDULE")
      expect(text).toContain("POST /schedules")
      expect(text).toContain("CURL:")
      expect(text).not.toContain("JAVASCRIPT/TYPESCRIPT:")
      expect(text).not.toContain("PYTHON:")
    })

    it("includes api-key-access-disabled section when API keys are disabled", () => {
      const content = buildApiDocsContent(false)
      const text = serializeToPlainText(content)

      expect(text).toContain("API KEY ACCESS IS DISABLED FOR THIS ACCOUNT")
    })

    it("excludes api-key-access-disabled section when API keys are enabled", () => {
      const content = buildApiDocsContent(true)
      const text = serializeToPlainText(content)

      expect(text).not.toContain("API key access is disabled")
    })
  })

  describe("tocItems derivation", () => {
    it("includes the curated section ids in tocItems", () => {
      const content = buildApiDocsContent(true)
      const tocIds = content.tocItems.map((item) => item.id)

      expect(tocIds).toEqual([
        "quick-start",
        "concepts",
        "authentication",
        "submit-scan",
        "watch-progress",
        "scan-report",
        "scan-technologies",
        "fetch-results",
        "list-runs",
        "list-schedules",
        "api-key-management",
        "error-handling",
      ])
      expect(new Set(tocIds).size).toBe(tocIds.length)
    })

    it("maps section ids to human-readable labels", () => {
      const content = buildApiDocsContent(true)

      const quickStart = content.tocItems.find((item) => item.id === "quick-start")
      expect(quickStart?.label).toBe("Quick start")

      const concepts = content.tocItems.find((item) => item.id === "concepts")
      expect(concepts?.label).toBe("Concepts")

      const apiKeyManagement = content.tocItems.find((item) => item.id === "api-key-management")
      expect(apiKeyManagement?.label).toBe("API key management")
    })
  })
})
