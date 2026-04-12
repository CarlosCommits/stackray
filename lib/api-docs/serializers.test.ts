import { describe, expect, it } from "vitest"
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
      expect(markdown).toContain("| /api/v1 | Bearer token | SSE events |")
    })

    it("generates markdown for quick-start section", () => {
      const content = buildApiDocsContent(true)
      const markdown = serializeToMarkdown(content)

      expect(markdown).toContain("## Quick start")
      expect(markdown).toContain("Start here if you just created a token")
      expect(markdown).toContain("`/settings/tokens`")
      expect(markdown).toContain("`GET /runs`")
    })

    it("generates markdown for authentication section", () => {
      const content = buildApiDocsContent(true)
      const markdown = serializeToMarkdown(content)

      expect(markdown).toContain("## Authentication modes")
      expect(markdown).toContain("Bearer token")
      expect(markdown).toContain("Browser session")
      expect(markdown).toContain("Authorization: Bearer sr_live_your_token_here")
    })

    it("generates markdown for endpoint sections", () => {
      const content = buildApiDocsContent(true)
      const markdown = serializeToMarkdown(content)

      expect(markdown).toContain("## Submit a scan")
      expect(markdown).toContain("**POST /scans**")
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

    it("generates markdown for token management section", () => {
      const content = buildApiDocsContent(true)
      const markdown = serializeToMarkdown(content)

      expect(markdown).toContain("## Token management")
      expect(markdown).toContain("### GET /tokens")
      expect(markdown).toContain("### POST /tokens")
      expect(markdown).toContain("### DELETE /tokens/:tokenId")
    })

    it("generates markdown for error handling section", () => {
      const content = buildApiDocsContent(true)
      const markdown = serializeToMarkdown(content)

      expect(markdown).toContain("## Error handling")
      expect(markdown).toContain("`invalid_api_token`")
      expect(markdown).toContain("`invalid_target`")
    })

    it("includes token-access-disabled section when tokens are disabled", () => {
      const content = buildApiDocsContent(false)
      const markdown = serializeToMarkdown(content)

      expect(markdown).toContain("## Token access is disabled for this account")
    })

    it("excludes token-access-disabled section when tokens are enabled", () => {
      const content = buildApiDocsContent(true)
      const markdown = serializeToMarkdown(content)

      expect(markdown).not.toContain("Token access is disabled")
    })
  })

  describe("serializeToPlainText", () => {
    it("generates plain text for intro section with API overview", () => {
      const content = buildApiDocsContent(true)
      const text = serializeToPlainText(content)

      expect(text).toContain("STACKRAY API DOCUMENTATION")
      expect(text).toContain("API DOCS")
      expect(text).toContain("Base path: /api/v1")
      expect(text).toContain("Primary auth: Bearer token")
    })

    it("generates plain text for quick-start section", () => {
      const content = buildApiDocsContent(true)
      const text = serializeToPlainText(content)

      expect(text).toContain("QUICK START")
      expect(text).toContain("Start here if you just created a token")
    })

    it("generates plain text for endpoint sections", () => {
      const content = buildApiDocsContent(true)
      const text = serializeToPlainText(content)

      expect(text).toContain("SUBMIT A SCAN")
      expect(text).toContain("POST /scans")
      expect(text).toContain("LIST SCHEDULES")
      expect(text).toContain("GET /schedules")
      expect(text).toContain("CREATE A SCHEDULE")
      expect(text).toContain("POST /schedules")
      expect(text).toContain("CURL:")
      expect(text).toContain("JAVASCRIPT/TYPESCRIPT:")
      expect(text).toContain("PYTHON:")
    })

    it("includes token-access-disabled section when tokens are disabled", () => {
      const content = buildApiDocsContent(false)
      const text = serializeToPlainText(content)

      expect(text).toContain("TOKEN ACCESS IS DISABLED FOR THIS ACCOUNT")
    })

    it("excludes token-access-disabled section when tokens are enabled", () => {
      const content = buildApiDocsContent(true)
      const text = serializeToPlainText(content)

      expect(text).not.toContain("Token access is disabled")
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
        expect(tocIds).toContain("list-runs")
        expect(tocIds).toContain("query-targets")
        expect(tocIds).toContain("list-schedules")
        expect(tocIds).toContain("create-schedule")
        expect(tocIds).toContain("update-schedule")
        expect(tocIds).toContain("delete-schedule")
        expect(tocIds).toContain("token-management")
        expect(tocIds).toContain("error-handling")
      })

    it("maps section ids to human-readable labels", () => {
      const content = buildApiDocsContent(true)

      const quickStart = content.tocItems.find((item) => item.id === "quick-start")
      expect(quickStart?.label).toBe("Quick start")

      const tokenManagement = content.tocItems.find((item) => item.id === "token-management")
      expect(tokenManagement?.label).toBe("Token management")
    })
  })
})
