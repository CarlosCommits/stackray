import { describe, expect, it } from "vitest"

import { buildStructuredTechnologyDetection, canonicalizeTechnologyLabel } from "@/lib/server/scans/technology-metadata-catalog"

describe("custom technology metadata", () => {
  it("enriches custom technologies that are not in the generated Wappalyzer catalog", () => {
    const detection = buildStructuredTechnologyDetection({
      name: "tanstack start",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })

    expect(detection.name).toBe("TanStack Start")
    expect(detection.website).toBe("https://tanstack.com/start")
    expect(detection.categories).toEqual(["Web frameworks", "JavaScript frameworks"])
    expect(detection.bucket).toBe("framework")
    expect(detection.iconUrl).toContain("TanStack.svg")
  })

  it("canonicalizes custom technology labels before persistence", () => {
    expect(canonicalizeTechnologyLabel("tanstack router")).toEqual({
      name: "TanStack Router",
      version: null,
    })
  })

  it("enriches Helply from Stackray custom metadata", () => {
    const detection = buildStructuredTechnologyDetection({
      name: "helply",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })

    expect(detection.name).toBe("Helply")
    expect(detection.website).toBe("https://helply.com")
    expect(detection.categories).toEqual(["Live chat"])
    expect(detection.bucket).toBe("business")
  })

  it("enriches Uvicorn from Stackray custom metadata", () => {
    const detection = buildStructuredTechnologyDetection({
      name: "uvicorn",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })

    expect(detection.name).toBe("Uvicorn")
    expect(detection.website).toBe("https://www.uvicorn.org/")
    expect(detection.categories).toEqual(["Web servers"])
    expect(detection.bucket).toBe("infrastructure")
  })

  it("enriches Cloudflare Web Analytics from Stackray custom metadata", () => {
    const detection = buildStructuredTechnologyDetection({
      name: "cloudflare web analytics",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })

    expect(detection.name).toBe("Cloudflare Web Analytics")
    expect(detection.website).toBe("https://www.cloudflare.com/web-analytics/")
    expect(detection.categories).toEqual(["Analytics", "RUM"])
    expect(detection.bucket).toBe("business")
    expect(detection.iconUrl).toContain("CloudFlare.svg")
  })

  it("enriches Convex from Stackray custom metadata", () => {
    const detection = buildStructuredTechnologyDetection({
      name: "convex",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })

    expect(detection.name).toBe("Convex")
    expect(detection.website).toBe("https://www.convex.dev/")
    expect(detection.categories).toEqual(["Databases", "Development"])
    expect(detection.bucket).toBe("infrastructure")
    expect(detection.iconUrl).toBe("https://www.convex.dev/favicon.ico")
  })

  it("canonicalizes the Convex Backend scanner alias", () => {
    expect(canonicalizeTechnologyLabel("convex backend")).toEqual({
      name: "Convex",
      version: null,
    })
  })

  it("enriches DNS service technologies from Stackray custom metadata", () => {
    const route53 = buildStructuredTechnologyDetection({
      name: "amazon route 53",
      version: null,
      sources: ["nuclei"],
      inferred: true,
    })

    const azureDns = buildStructuredTechnologyDetection({
      name: "microsoft azure dns",
      version: null,
      sources: ["nuclei"],
      inferred: true,
    })

    const zoom = buildStructuredTechnologyDetection({
      name: "zoom",
      version: null,
      sources: ["nuclei"],
      inferred: true,
    })

    expect(route53.name).toBe("Amazon Route 53")
    expect(route53.website).toBe("https://aws.amazon.com/route53/")
    expect(route53.categories).toEqual(["DNS"])
    expect(route53.bucket).toBe("infrastructure")
    expect(route53.iconUrl).toContain("Amazon%20Web%20Services.svg")

    expect(azureDns.name).toBe("Microsoft Azure DNS")
    expect(azureDns.website).toBe("https://azure.microsoft.com/products/dns/")
    expect(azureDns.categories).toEqual(["DNS"])
    expect(azureDns.bucket).toBe("infrastructure")
    expect(azureDns.iconUrl).toContain("Azure.svg")

    expect(zoom.name).toBe("Zoom")
    expect(zoom.website).toBe("https://www.zoom.com/")
    expect(zoom.categories).toEqual(["Video conferencing"])
    expect(zoom.bucket).toBe("business")
    expect(zoom.iconUrl).toContain("simple-icons/simple-icons/develop/icons/zoom.svg")
  })

  it("enriches TXT-derived service technologies from Stackray custom metadata", () => {
    const serviceNames = [
      ["smartsheet", "Smartsheet", "https://www.smartsheet.com/", "business", "https://www.smartsheet.com/favicon.ico"],
      ["salesforce-pardot", "Salesforce Pardot", "https://www.salesforce.com/products/marketing-cloud/marketing-automation/", "business", "Salesforce.svg"],
      ["cisco-cloud-intelligence", "Cisco Cloud Intelligence", "https://www.cisco.com/", "security", "simple-icons/simple-icons/develop/icons/cisco.svg"],
      ["globalsign", "GlobalSign", "https://www.globalsign.com/", "security", "https://www.globalsign.com/favicon.ico"],
      ["box", "Box", "https://www.box.com/", "platform", "simple-icons/simple-icons/develop/icons/box.svg"],
      ["google apps", "Google Workspace", "https://workspace.google.com/", "platform", "Google.svg"],
      ["google-apps", "Google Workspace", "https://workspace.google.com/", "platform", "Google.svg"],
      ["atlassian", "Atlassian", "https://www.atlassian.com/", "platform", "simple-icons/simple-icons/develop/icons/atlassian.svg"],
      ["twilio", "Twilio", "https://www.twilio.com/", "business", "https://www.twilio.com/favicon.ico"],
      ["zoom-alternative", "Zoom", "https://www.zoom.com/", "business", "simple-icons/simple-icons/develop/icons/zoom.svg"],
      ["zoom alternative", "Zoom", "https://www.zoom.com/", "business", "simple-icons/simple-icons/develop/icons/zoom.svg"],
      ["uber", "Uber", "https://www.uber.com/", "business", "simple-icons/simple-icons/develop/icons/uber.svg"],
      ["cursor", "Cursor", "https://cursor.com/", "other", "simple-icons/simple-icons/develop/icons/cursor.svg"],
      ["openai", "OpenAI", "https://openai.com/", "business", "simple-icons/simple-icons/develop/icons/openai.svg"],
      ["jamf", "Jamf", "https://www.jamf.com/", "security", "https://www.jamf.com/favicon.ico"],
      ["zapier", "Zapier", "https://zapier.com/", "business", "simple-icons/simple-icons/develop/icons/zapier.svg"],
      ["office 365", "Microsoft 365", "https://www.microsoft.com/microsoft-365", "platform", "Microsoft%20365.svg"],
      ["webex", "Webex", "https://www.webex.com/", "business", "simple-icons/simple-icons/develop/icons/webex.svg"],
      ["apple", "Apple Business Manager", "https://business.apple.com/", "security", "simple-icons/simple-icons/develop/icons/apple.svg"],
      ["monday", "monday.com", "https://monday.com/", "business", "https://monday.com/favicon.ico"],
      ["monday.com", "monday.com", "https://monday.com/", "business", "https://monday.com/favicon.ico"],
      ["facebook workplace", "Workplace from Meta", "https://www.workplace.com/", "business", "simple-icons/simple-icons/develop/icons/workplace.svg"],
      ["figma", "Figma", "https://www.figma.com/", "business", "simple-icons/simple-icons/develop/icons/figma.svg"],
    ] as const

    for (const [inputName, expectedName, expectedWebsite, expectedBucket, expectedIconUrlPart] of serviceNames) {
      const detection = buildStructuredTechnologyDetection({
        name: inputName,
        version: null,
        sources: ["nuclei"],
        inferred: true,
      })

      expect(detection.name).toBe(expectedName)
      expect(detection.website).toBe(expectedWebsite)
      expect(detection.bucket).toBe(expectedBucket)
      expect(detection.iconUrl).toContain(expectedIconUrlPart)
    }
  })

  it("enriches Clerk from the generated Wappalyzer metadata", () => {
    const detection = buildStructuredTechnologyDetection({
      name: "clerk",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })

    expect(detection.name).toBe("Clerk")
    expect(detection.website).toBe("https://clerk.dev")
    expect(detection.categories).toEqual(["Authentication"])
    expect(detection.bucket).toBe("security")
    expect(detection.iconUrl).toContain("Clerk.svg")
  })
})
