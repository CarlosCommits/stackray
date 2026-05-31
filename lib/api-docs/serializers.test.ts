import { describe, expect, it } from "vitest"
import { buildApiDocsContent } from "./content"
import { serializeToMarkdown, serializeToPlainText } from "./serializers"

describe("api-docs serializers", () => {
  describe("serializeToMarkdown", () => {
    it("uses the resolved public origin in examples when provided", () => {
      const content = buildApiDocsContent(true, "https://demo.stackray.app")
      const markdown = serializeToMarkdown(content)

      expect(markdown).toContain("https://demo.stackray.app")
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
      expect(markdown).toContain("`GET /runs`")
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

    it("generates markdown for endpoint sections", () => {
      const content = buildApiDocsContent(true)
      const markdown = serializeToMarkdown(content)

      expect(markdown).toContain("## Submit a scan")
      expect(markdown).toContain("**POST /scans**")
      expect(markdown).toContain("## Fetch technologies for a scan")
      expect(markdown).toContain("**GET /scans/:scanId/technologies**")
      expect(markdown).toContain("## Fetch technologies for a scan result")
      expect(markdown).toContain("**GET /scans/:scanId/results/:resultId/technologies**")
      expect(markdown).toContain("## Fetch technologies for a target")
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
      expect(markdown).toContain("### JavaScript / TypeScript")
      expect(markdown).toContain("### Python")
      expect(markdown).toContain("### Response")
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
      expect(text).toContain("FETCH TECHNOLOGIES FOR A SCAN")
      expect(text).toContain("GET /scans/:scanId/technologies")
      expect(text).toContain("FETCH TECHNOLOGIES FOR A SCAN RESULT")
      expect(text).toContain("GET /scans/:scanId/results/:resultId/technologies")
      expect(text).toContain("FETCH TECHNOLOGIES FOR A TARGET")
      expect(text).toContain("GET /targets/:canonicalTargetId/technologies")
      expect(text).toContain("LIST SCHEDULES")
      expect(text).toContain("GET /schedules")
      expect(text).toContain("CREATE A SCHEDULE")
      expect(text).toContain("POST /schedules")
      expect(text).toContain("CURL:")
      expect(text).toContain("JAVASCRIPT/TYPESCRIPT:")
      expect(text).toContain("PYTHON:")
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
    it("includes all section ids in tocItems", () => {
      const content = buildApiDocsContent(true)
      const tocIds = content.tocItems.map((item) => item.id)

      expect(tocIds).toContain("quick-start")
      expect(tocIds).toContain("authentication")
      expect(tocIds).toContain("submit-scan")
        expect(tocIds).toContain("watch-progress")
        expect(tocIds).toContain("fetch-results")
        expect(tocIds).toContain("scan-technologies")
        expect(tocIds).toContain("result-technologies")
        expect(tocIds).toContain("list-runs")
        expect(tocIds).toContain("query-targets")
        expect(tocIds).toContain("target-technologies")
        expect(tocIds).toContain("list-schedules")
        expect(tocIds).toContain("create-schedule")
        expect(tocIds).toContain("update-schedule")
        expect(tocIds).toContain("delete-schedule")
        expect(tocIds).toContain("api-key-management")
        expect(tocIds).toContain("error-handling")
      })

    it("maps section ids to human-readable labels", () => {
      const content = buildApiDocsContent(true)

      const quickStart = content.tocItems.find((item) => item.id === "quick-start")
      expect(quickStart?.label).toBe("Quick start")

      const apiKeyManagement = content.tocItems.find((item) => item.id === "api-key-management")
      expect(apiKeyManagement?.label).toBe("API key management")
    })
  })
})
