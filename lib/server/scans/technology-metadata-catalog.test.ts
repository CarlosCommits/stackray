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

  it("uses custom icon overrides for generated Django and Python metadata", () => {
    const django = buildStructuredTechnologyDetection({
      name: "django",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })
    const python = buildStructuredTechnologyDetection({
      name: "python",
      version: null,
      sources: ["derived"],
      inferred: true,
    })

    expect(django.name).toBe("Django")
    expect(django.description).toContain("Python-based")
    expect(django.categories).toEqual(["Web frameworks"])
    expect(django.iconUrl).toBe("https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/django.svg")

    expect(python.name).toBe("Python")
    expect(python.description).toContain("general-purpose programming language")
    expect(python.categories).toEqual(["Programming languages"])
    expect(python.iconUrl).toBe("https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/python.svg")
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

  it("enriches XTerm.js from Stackray custom metadata", () => {
    const detection = buildStructuredTechnologyDetection({
      name: "xtermjs",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })

    expect(detection.name).toBe("XTerm.js")
    expect(detection.website).toBe("https://xtermjs.org/")
    expect(detection.categories).toEqual(["JavaScript libraries"])
    expect(detection.bucket).toBe("other")
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

  it("enriches DataFast from Stackray custom metadata", () => {
    const detection = buildStructuredTechnologyDetection({
      name: "datafast",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })

    expect(detection.name).toBe("DataFast")
    expect(detection.website).toBe("https://datafa.st/")
    expect(detection.categories).toEqual(["Analytics"])
    expect(detection.bucket).toBe("business")
    expect(detection.iconUrl).toBe("https://datafa.st/favicon.ico")
  })

  it("enriches CI and data infrastructure tools from Stackray custom metadata", () => {
    const circleCi = buildStructuredTechnologyDetection({
      name: "circleci",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })
    const dagster = buildStructuredTechnologyDetection({
      name: "dagster",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })
    const fivetran = buildStructuredTechnologyDetection({
      name: "fivetran",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })
    const openSearch = buildStructuredTechnologyDetection({
      name: "opensearch",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })
    const terraform = buildStructuredTechnologyDetection({
      name: "terraform",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })

    expect(circleCi.name).toBe("CircleCI")
    expect(circleCi.categories).toEqual(["CI"])
    expect(circleCi.bucket).toBe("infrastructure")
    expect(circleCi.iconUrl).toContain("simple-icons/simple-icons/develop/icons/circleci.svg")

    expect(dagster.name).toBe("Dagster")
    expect(dagster.website).toBe("https://dagster.io/")
    expect(dagster.categories).toEqual(["Development"])
    expect(dagster.iconUrl).toContain("WebClipDagster2.png")

    expect(fivetran.name).toBe("Fivetran")
    expect(fivetran.categories).toEqual(["Customer data platform", "Development"])
    expect(fivetran.iconUrl).toContain("Webclip%20%5BLight%5D.png")

    expect(openSearch.name).toBe("OpenSearch")
    expect(openSearch.categories).toEqual(["Search engines", "Databases"])
    expect(openSearch.bucket).toBe("platform")
    expect(openSearch.iconUrl).toContain("simple-icons/simple-icons/develop/icons/opensearch.svg")

    expect(terraform.name).toBe("Terraform")
    expect(terraform.categories).toEqual(["Development", "PaaS"])
    expect(terraform.iconUrl).toContain("simple-icons/simple-icons/develop/icons/terraform.svg")
  })

  it("enriches Mux from Stackray custom metadata", () => {
    const detection = buildStructuredTechnologyDetection({
      name: "mux",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })

    expect(detection.name).toBe("Mux")
    expect(detection.website).toBe("https://www.mux.com")
    expect(detection.categories).toEqual(["Analytics", "Video players"])
    expect(detection.bucket).toBe("business")
    expect(detection.iconUrl).toContain("Mux.svg")
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

  it("canonicalizes the Redis Backend scanner alias", () => {
    const detection = buildStructuredTechnologyDetection({
      name: "redis backend",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })

    expect(canonicalizeTechnologyLabel("redis backend")).toEqual({
      name: "Redis",
      version: null,
    })
    expect(detection.name).toBe("Redis")
    expect(detection.website).toBe("https://redis.io")
    expect(detection.categories).toEqual(["Databases"])
    expect(detection.bucket).toBe("infrastructure")
    expect(detection.iconUrl).toContain("Redis.svg")
  })

  it("enriches Upstash from Stackray custom metadata", () => {
    const detection = buildStructuredTechnologyDetection({
      name: "upstash",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })

    expect(detection.name).toBe("Upstash")
    expect(detection.website).toBe("https://upstash.com/")
    expect(detection.categories).toEqual(["Databases", "PaaS"])
    expect(detection.bucket).toBe("infrastructure")
    expect(detection.iconUrl).toBe("https://upstash.com/favicon.ico")
  })

  it("enriches custom browser-sweep technologies that are absent from the generated catalog", () => {
    const factors = buildStructuredTechnologyDetection({
      name: "factors.ai",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })

    const eppo = buildStructuredTechnologyDetection({
      name: "eppo",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })

    const g2 = buildStructuredTechnologyDetection({
      name: "g2",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })

    expect(factors.name).toBe("Factors.ai")
    expect(factors.website).toBe("https://www.factors.ai/")
    expect(factors.categories).toEqual(["Analytics", "Marketing automation"])
    expect(factors.bucket).toBe("business")
    expect(factors.iconUrl).toContain("favicon-32x32.png")

    expect(eppo.name).toBe("Eppo")
    expect(eppo.categories).toEqual(["Feature management", "A/B Testing"])
    expect(eppo.iconUrl).toContain("favicon-32x32.png")

    expect(g2.name).toBe("G2")
    expect(g2.website).toBe("https://www.g2.com/")
    expect(g2.categories).toEqual(["Reviews", "Marketing automation"])
    expect(g2.iconUrl).toContain("simple-icons/simple-icons/develop/icons/g2.svg")
  })

  it("enriches browser-sweep detector additions that are absent from the generated catalog", () => {
    const pingOneDaVinci = buildStructuredTechnologyDetection({
      name: "pingone davinci",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })
    const storyteller = buildStructuredTechnologyDetection({
      name: "storyteller",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })
    const granify = buildStructuredTechnologyDetection({
      name: "granify",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })
    const ahrefsAnalytics = buildStructuredTechnologyDetection({
      name: "ahrefs analytics",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })
    const unicornStudio = buildStructuredTechnologyDetection({
      name: "unicorn studio",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })
    const datadogRum = buildStructuredTechnologyDetection({
      name: "datadog rum",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })
    const adobeWebSdk = buildStructuredTechnologyDetection({
      name: "adobe experience platform web sdk",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })

    expect(pingOneDaVinci.name).toBe("PingOne DaVinci")
    expect(pingOneDaVinci.website).toContain("pingidentity.com")
    expect(pingOneDaVinci.categories).toEqual(["Authentication"])
    expect(pingOneDaVinci.bucket).toBe("security")
    expect(pingOneDaVinci.iconUrl).toBe("https://www.google.com/s2/favicons?domain=pingidentity.com&sz=128")

    expect(storyteller.name).toBe("Storyteller")
    expect(storyteller.categories).toEqual(["Video players", "Widgets"])
    expect(storyteller.iconUrl).toBe("https://www.usestoryteller.com/favicon.ico")

    expect(granify.name).toBe("Granify")
    expect(granify.categories).toEqual(["Personalisation", "Ecommerce"])
    expect(granify.bucket).toBe("business")
    expect(granify.iconUrl).toBe("https://www.google.com/s2/favicons?domain=info.granify.com&sz=128")

    expect(ahrefsAnalytics.name).toBe("Ahrefs Analytics")
    expect(ahrefsAnalytics.categories).toEqual(["Analytics"])
    expect(ahrefsAnalytics.bucket).toBe("business")

    expect(unicornStudio.name).toBe("Unicorn Studio")
    expect(unicornStudio.categories).toEqual(["Page builders"])
    expect(unicornStudio.website).toBe("https://www.unicorn.studio/")

    expect(datadogRum.name).toBe("Datadog RUM")
    expect(datadogRum.categories).toEqual(["Analytics", "RUM"])
    expect(datadogRum.iconUrl).toContain("simple-icons/simple-icons/develop/icons/datadog.svg")

    expect(adobeWebSdk.name).toBe("Adobe Experience Platform Web SDK")
    expect(adobeWebSdk.categories).toEqual(["Customer data platform"])
    expect(adobeWebSdk.bucket).toBe("business")
  })

  it("enriches BuiltWith-led detector additions that are absent from the generated catalog", () => {
    const visitorAnalytics = buildStructuredTechnologyDetection({
      name: "visitor analytics",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })
    const jqueryCookie = buildStructuredTechnologyDetection({
      name: "jquery cookie",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })
    const jqueryValidate = buildStructuredTechnologyDetection({
      name: "jquery validate",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })
    const opinionStage = buildStructuredTechnologyDetection({
      name: "opinion stage",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })
    const adobeHelixRum = buildStructuredTechnologyDetection({
      name: "adobe helix rum",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })
    const jscrambler = buildStructuredTechnologyDetection({
      name: "jscrambler",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })

    expect(visitorAnalytics.name).toBe("Visitor Analytics")
    expect(visitorAnalytics.categories).toEqual(["Analytics"])
    expect(visitorAnalytics.iconUrl).toBe("https://www.visitor-analytics.io/favicon.ico")

    expect(jqueryCookie.name).toBe("jQuery Cookie")
    expect(jqueryCookie.categories).toEqual(["JavaScript libraries"])
    expect(jqueryCookie.iconUrl).toContain("jQuery.svg")

    expect(jqueryValidate.name).toBe("jQuery Validate")
    expect(jqueryValidate.categories).toEqual(["JavaScript libraries"])
    expect(jqueryValidate.iconUrl).toContain("jQuery.svg")

    expect(opinionStage.name).toBe("Opinion Stage")
    expect(opinionStage.categories).toEqual(["Surveys", "Widgets"])
    expect(opinionStage.iconUrl).toContain("opinionstage-res.cloudinary.com")

    expect(adobeHelixRum.name).toBe("Adobe Helix RUM")
    expect(adobeHelixRum.categories).toEqual(["Analytics", "RUM"])
    expect(adobeHelixRum.iconUrl).toContain("Adobe.svg")

    expect(jscrambler.name).toBe("Jscrambler")
    expect(jscrambler.categories).toEqual(["Security"])
    expect(jscrambler.iconUrl).toBe("https://jscrambler.com/favicon.ico")
  })

  it("fills missing upstream descriptions with sparse custom metadata", () => {
    const clickbank = buildStructuredTechnologyDetection({
      name: "clickbank",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })

    expect(clickbank.name).toBe("Clickbank")
    expect(clickbank.description).toBe(
      "ClickBank is an affiliate marketplace and ecommerce platform for selling, promoting, and tracking digital products.",
    )
    expect(clickbank.website).toBe("https://www.clickbank.com/")
    expect(clickbank.categories).toEqual(["Affiliate programs"])
    expect(clickbank.iconUrl).toContain("Clickbank.svg")
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
      ["pardot-mail", "Pardot Mail", "https://www.salesforce.com/products/marketing-cloud/marketing-automation/", "business", "Salesforce.svg"],
      ["salesforce marketing cloud", "Salesforce Marketing Cloud", "https://www.salesforce.com/marketing/", "business", "Salesforce.svg"],
      ["sfmc", "Salesforce Marketing Cloud", "https://www.salesforce.com/marketing/", "business", "Salesforce.svg"],
      ["salesforce spf", "Salesforce SPF", "https://help.salesforce.com/", "business", "Salesforce.svg"],
      ["mailgun", "Mailgun", "https://www.mailgun.com/", "business", "Mailgun.svg"],
      ["proofpoint", "Proofpoint", "https://www.proofpoint.com/", "security", "https://www.proofpoint.com/favicon.ico"],
      ["resend", "Resend", "https://resend.com/", "business", "simple-icons/simple-icons/develop/icons/resend.svg"],
      ["cisco-cloud-intelligence", "Cisco Cloud Intelligence", "https://www.cisco.com/", "security", "simple-icons/simple-icons/develop/icons/cisco.svg"],
      ["globalsign", "GlobalSign", "https://www.globalsign.com/", "security", "https://www.globalsign.com/favicon.ico"],
      ["box", "Box", "https://www.box.com/", "platform", "simple-icons/simple-icons/develop/icons/box.svg"],
      ["google apps", "Google Workspace", "https://workspace.google.com/", "platform", "Google.svg"],
      ["google-apps", "Google Workspace", "https://workspace.google.com/", "platform", "Google.svg"],
      ["google site verification", "Google Site Verification", "https://support.google.com/webmasters/answer/9008080", "security", "Google.svg"],
      ["yandex", "Yandex Site Verification", "https://yandex.com/support/webmaster/en/service/rights.html", "security", "simple-icons@latest/icons/yandex.svg"],
      ["yandex site verification", "Yandex Site Verification", "https://yandex.com/support/webmaster/en/service/rights.html", "security", "simple-icons@latest/icons/yandex.svg"],
      ["openai conversion tracking", "OpenAI Conversion Tracking", "https://openai.com/", "business", "simple-icons@latest/icons/openai.svg"],
      ["atlassian", "Atlassian", "https://www.atlassian.com/", "platform", "simple-icons/simple-icons/develop/icons/atlassian.svg"],
      ["atlassian-sending", "Atlassian Sending", "https://www.atlassian.com/", "business", "simple-icons/simple-icons/develop/icons/atlassian.svg"],
      ["slack", "Slack", "https://slack.com/", "business", "https://slack.com/favicon.ico"],
      ["1password", "1Password", "https://1password.com/", "security", "simple-icons/simple-icons/develop/icons/1password.svg"],
      ["perplexity-ai", "Perplexity AI", "https://www.perplexity.ai/", "business", "simple-icons/simple-icons/develop/icons/perplexity.svg"],
      ["anthropic", "Anthropic", "https://www.anthropic.com/", "business", "simple-icons/simple-icons/develop/icons/anthropic.svg"],
      ["twilio", "Twilio", "https://www.twilio.com/", "business", "https://www.twilio.com/favicon.ico"],
      ["zoom-alternative", "Zoom", "https://www.zoom.com/", "business", "simple-icons/simple-icons/develop/icons/zoom.svg"],
      ["zoom alternative", "Zoom", "https://www.zoom.com/", "business", "simple-icons/simple-icons/develop/icons/zoom.svg"],
      ["uber", "Uber", "https://www.uber.com/", "business", "simple-icons/simple-icons/develop/icons/uber.svg"],
      ["cursor", "Cursor", "https://cursor.com/", "business", "simple-icons/simple-icons/develop/icons/cursor.svg"],
      ["openai", "OpenAI", "https://openai.com/", "business", "simple-icons@latest/icons/openai.svg"],
      ["jamf", "Jamf", "https://www.jamf.com/", "security", "https://www.jamf.com/favicon.ico"],
      ["zapier", "Zapier", "https://zapier.com/", "business", "simple-icons/simple-icons/develop/icons/zapier.svg"],
      ["office 365", "Microsoft 365", "https://www.microsoft.com/microsoft-365", "platform", "Microsoft%20365.svg"],
      ["webex", "Webex", "https://www.webex.com/", "business", "simple-icons/simple-icons/develop/icons/webex.svg"],
      ["apple", "Apple Business Manager", "https://business.apple.com/", "security", "simple-icons/simple-icons/develop/icons/apple.svg"],
      ["monday", "monday.com", "https://monday.com/", "business", "https://monday.com/favicon.ico"],
      ["monday.com", "monday.com", "https://monday.com/", "business", "https://monday.com/favicon.ico"],
      ["facebook workplace", "Workplace from Meta", "https://www.workplace.com/", "business", "simple-icons/simple-icons/develop/icons/workplace.svg"],
      ["figma", "Figma", "https://www.figma.com/", "business", "simple-icons/simple-icons/develop/icons/figma.svg"],
      ["miro", "Miro", "https://miro.com/", "business", "simple-icons/simple-icons/develop/icons/miro.svg"],
      ["base ui", "Base UI", "https://base-ui.com/", "framework", "base-ui.com/static/apple-touch-icon.png"],
      ["whimsical", "Whimsical", "https://whimsical.com/", "business", "whimsical.com/_next_public/favicon-32.png"],
      ["rudderstack", "RudderStack", "https://rudderstack.com/", "business", "rudderstack.com/images/logos/logo-mark-dark.svg"],
      ["serval", "Serval", "https://www.serval.com/", "business", "framerusercontent.com/images/tnVG7kNmUtVPBcnIZCX1x14Yu5M.png"],
      ["loom", "Loom", "https://www.loom.com/", "business", "simple-icons/simple-icons/develop/icons/loom.svg"],
      ["hackerone", "HackerOne", "https://www.hackerone.com/", "security", "simple-icons/simple-icons/develop/icons/hackerone.svg"],
      ["h1", "HackerOne", "https://www.hackerone.com/", "security", "simple-icons/simple-icons/develop/icons/hackerone.svg"],
      ["amp by sourcegraph", "Amp by Sourcegraph", "https://ampcode.com/", "business", "https://ampcode.com/favicon.ico"],
      ["doordash", "DoorDash", "https://www.doordash.com/", "business", "simple-icons/simple-icons/develop/icons/doordash.svg"],
      ["plain", "Plain", "https://www.plain.com/", "business", "framerusercontent.com/images/BXA24c7albrT0OqBIAA9KPt1pg.png"],
      ["gather", "Gather", "https://www.gather.town/", "business", "framerusercontent.com/images/P5hrzskVvpcfIIXVKNXfzAkXLw.png"],
      ["notion", "Notion", "https://www.notion.com/", "business", "simple-icons/simple-icons/develop/icons/notion.svg"],
      ["carta", "Carta", "https://carta.com/", "business", "Carta.svg"],
      ["liveramp", "LiveRamp", "https://liveramp.com/", "business", "LiveRamp.svg"],
      ["creatopy", "The Brief", "https://www.thebrief.ai/", "business", "https://www.thebrief.ai/favicon.ico"],
      ["the brief", "The Brief", "https://www.thebrief.ai/", "business", "https://www.thebrief.ai/favicon.ico"],
      ["salesloft-drift", "Drift", "https://www.drift.com/", "business", "Drift.svg"],
      ["databank", "DataBank", "https://www.databank.com/", "infrastructure", "https://www.databank.com/favicon.ico"],
      ["klaviyo", "Klaviyo", "https://www.klaviyo.com/", "business", "Klaviyo.svg"],
      ["linear", "Linear", "https://linear.app/", "platform", "simple-icons/simple-icons/develop/icons/linear.svg"],
      ["lucidlink", "LucidLink", "https://www.lucidlink.com/", "infrastructure", "https://www.lucidlink.com/favicon.ico"],
      ["parsec", "Parsec", "https://parsec.app/", "infrastructure", "https://parsec.app/favicon.ico"],
      ["tailscale", "Tailscale", "https://tailscale.com/", "infrastructure", "https://tailscale.com/favicon.ico"],
      ["pylon", "Pylon", "https://usepylon.com/", "business", "https://usepylon.com/favicon.ico"],
      ["airalo", "Airalo", "https://www.airalo.com/", "business", "https://www.airalo.com/favicon.ico"],
      ["autodesk", "Autodesk", "https://www.autodesk.com/", "business", "https://www.autodesk.com/favicon.ico"],
      ["adobe-sign", "Adobe Acrobat Sign", "https://www.adobe.com/acrobat/business/sign.html", "security", "Adobe.svg"],
      ["adobe sign", "Adobe Acrobat Sign", "https://www.adobe.com/acrobat/business/sign.html", "security", "Adobe.svg"],
      ["adobe acrobat sign", "Adobe Acrobat Sign", "https://www.adobe.com/acrobat/business/sign.html", "security", "Adobe.svg"],
      ["bugcrowd", "Bugcrowd", "https://www.bugcrowd.com", "security", "Bugcrowd.svg"],
      ["sign in solutions", "Sign In Solutions", "https://signinsolutions.com/", "security", "signinsolutions.com/hubfs/Creatives/Templates/Sign-in-solutions.png"],
      ["traction-guest", "Sign In Solutions", "https://signinsolutions.com/", "security", "signinsolutions.com/hubfs/Creatives/Templates/Sign-in-solutions.png"],
      ["infoblox", "Infoblox", "https://www.infoblox.com/", "infrastructure", "infoblox.com/wp-content/uploads/cropped-android-chrome-512x512-1-192x192.png"],
      ["parallels", "Parallels", "https://www.parallels.com/", "infrastructure", "parallels.com/static/pl/typo3conf/ext/prls_theme/Resources/Public/theme/res/img/favicon/apple-touch-icon.png"],
      ["parallesl", "Parallels", "https://www.parallels.com/", "infrastructure", "parallels.com/static/pl/typo3conf/ext/prls_theme/Resources/Public/theme/res/img/favicon/apple-touch-icon.png"],
      ["postman", "Postman", "https://www.postman.com/", "other", "simple-icons/simple-icons/develop/icons/postman.svg"],
      ["wiz", "Wiz", "https://www.wiz.io/", "security", "wiz.io/favicon.png"],
      ["mandrill", "Mandrill", "https://mailchimp.com/features/transactional-email/", "business", "simple-icons/simple-icons/develop/icons/mailchimp.svg"],
      ["elevenlabs", "ElevenLabs", "https://elevenlabs.io/", "business", "simple-icons/simple-icons/develop/icons/elevenlabs.svg"],
      ["intacct", "Sage Intacct", "https://www.sage.com/en-us/sage-business-cloud/intacct/", "business", "simple-icons/simple-icons/develop/icons/sage.svg"],
      ["sage intacct", "Sage Intacct", "https://www.sage.com/en-us/sage-business-cloud/intacct/", "business", "simple-icons/simple-icons/develop/icons/sage.svg"],
      ["flexera", "Flexera", "https://www.flexera.com/", "business", "flexera.com/themes/custom/flexera/favicon.ico"],
      ["parkable", "Parkable", "https://parkable.com/en-us", "business", "parkable.com/favicon-32x32.png"],
      ["gitkraken", "GitKraken", "https://www.gitkraken.com/", "other", "simple-icons/simple-icons/develop/icons/gitkraken.svg"],
      ["intercom", "Intercom", "https://www.intercom.com", "business", "Intercom.svg"],
      ["razorpay", "Razorpay", "https://razorpay.com/", "business", "Razorpay.svg"],
      ["bitrise", "Bitrise", "https://bitrise.io/", "infrastructure", "simple-icons/simple-icons/develop/icons/bitrise.svg"],
      ["mentimeter", "Mentimeter", "https://www.mentimeter.com/", "business", "static.mentimeter.com/assets/logotype/favicon-192x192.png"],
      ["bluebeam", "Bluebeam", "https://www.bluebeam.com/", "business", "bluebeam.com/wp-content/uploads/2022/07/cropped-favicon-32x32-1-300x300.png"],
      ["censys", "Censys", "https://censys.com/", "security", "censys.com/wp-content/uploads/Censys-Favicon.jpg"],
      ["krisp", "Krisp", "https://krisp.ai/", "business", "krisp.ai/wp-content/uploads/2023/12/cropped-favicon-1-192x192.png"],
      ["manus", "Manus", "https://manus.im/", "business", "manus.im/icon.png"],
      ["meshy", "Meshy", "https://www.meshy.ai/", "business", "meshy.ai/icon3.png"],
      ["dust", "Dust", "https://dust.tt/", "business", "app.dust.tt/static/AppIcon_180.png"],
      ["gamma", "Gamma", "https://gamma.app/", "business", "static.gamma.app/favicons/favicon_dark.svg"],
      ["stytch", "Stytch", "https://stytch.com/", "security", "stytch.com/favicon.ico"],
      ["leadfeeder", "Leadfeeder", "https://www.leadfeeder.com/", "business", "leadfeeder.com/favicon.svg"],
      ["netflow-analyzer-zoho-traffic-management", "ManageEngine NetFlow Analyzer", "https://www.manageengine.com/products/netflow/", "infrastructure", "cdn.manageengine.com/sites/meweb/images/touch_icons/apple-touch-icon-144-precomposed.png"],
      ["manageengine netflow analyzer", "ManageEngine NetFlow Analyzer", "https://www.manageengine.com/products/netflow/", "infrastructure", "cdn.manageengine.com/sites/meweb/images/touch_icons/apple-touch-icon-144-precomposed.png"],
      ["reachdesk", "Reachdesk", "https://www.reachdesk.com/", "business", "cdn.prod.website-files.com/67fe74838c447b0cd7f66a0e/6831e7eaf462250e703bd121_reackdesk-favicon.png"],
      ["attio", "Attio", "https://attio.com/", "business", "attio.com/favicon.ico"],
      ["hex", "Hex", "https://hex.tech/", "business", "hex.tech/favicon.svg"],
      ["hextech", "Hex", "https://hex.tech/", "business", "hex.tech/favicon.svg"],
      ["knowbe4", "KnowBe4", "https://www.knowbe4.com/", "security", "knowbe4.com/hubfs/favicon_white_bg-1.png"],
      ["aem_cms", "Adobe Experience Manager", "https://business.adobe.com/products/experience-manager/adobe-experience-manager.html", "platform", "Adobe%20Experience%20Platform.svg"],
      ["jetbrains", "JetBrains", "https://www.jetbrains.com/", "other", "simple-icons/simple-icons/develop/icons/jetbrains.svg"],
      ["sprig", "Sprig", "https://sprig.com", "business", "cdn.prod.website-files.com/651206cc884d0caef0f4c520/6a0f3c4821272afa99a6e117_favicon.png"],
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

  it("overrides missing and stale icon metadata for detected technologies", () => {
    const serviceNames = [
      ["hsts", "HSTS", "security", "www.rfc-editor.org/favicon.ico"],
      ["open graph", "Open Graph", "other", "ogp.me/favicon.ico"],
      ["facebook", "Facebook", "business", "Facebook.svg"],
      ["GSAP", "GSAP", "framework", "simple-icons@latest/icons/greensock.svg"],
      ["Hammer.js", "Hammer.js", "other", "hammerjs.github.io/assets/img/favicon.ico"],
      ["CKEditor", "CKEditor", "other", "ckeditor.com/assets/images/favicons/96x96.png"],
      ["Lightbox", "Lightbox", "other", "lokeshdhakar.com/favicon.ico"],
      ["Wrike", "Wrike", "business", "www.wrike.com/favicon.ico"],
      ["Mimecast", "Mimecast", "security", "www.mimecast.com/sc-static/img/favicons/icons_m_192x192.png"],
      ["Openfire", "Openfire", "business", "www.igniterealtime.org/favicon.ico"],
      ["ClickDimensions", "ClickDimensions", "business", "www.clickdimensions.com/favicon.ico"],
      ["ClickTale", "ClickTale", "business", "contentsquare.com/favicons/favicon-32x32.png"],
      ["VMware Cloud", "VMware Cloud", "infrastructure", "simple-icons@latest/icons/vmware.svg"],
      ["Clearbit Reveal", "Clearbit Reveal", "business", "clearbit.com/favicon.ico"],
      ["particles.js", "particles.js", "other", "google.com/s2/favicons?domain=vincentgarreau.com&sz=64"],
      ["unpkg", "Unpkg", "infrastructure", "simple-icons/simple-icons/develop/icons/unpkg.svg"],
      ["plausible analytics", "Plausible Analytics", "business", "simple-icons/simple-icons/develop/icons/plausibleanalytics.svg"],
      ["emotion", "Emotion", "framework", "google.com/s2/favicons?domain=emotion.sh"],
      ["envoy", "Envoy", "infrastructure", "simple-icons/simple-icons/develop/icons/envoyproxy.svg"],
    ] as const

    for (const [inputName, expectedName, expectedBucket, expectedIconUrlPart] of serviceNames) {
      const detection = buildStructuredTechnologyDetection({
        name: inputName,
        version: null,
        sources: ["wappalyzer"],
        inferred: false,
      })

      expect(detection.name).toBe(expectedName)
      expect(detection.bucket).toBe(expectedBucket)
      expect(detection.iconUrl).toContain(expectedIconUrlPart)
    }
  })

  it("describes Facebook TXT detections as domain verification evidence", () => {
    const detection = buildStructuredTechnologyDetection({
      name: "facebook",
      version: null,
      sources: ["nuclei"],
      inferred: true,
    })

    expect(detection.name).toBe("Facebook")
    expect(detection.description).toBe(
      "Facebook Domain Verification is Meta's DNS TXT ownership proof for connecting a domain to Facebook and Meta business tools.",
    )
    expect(detection.website).toBe("https://developers.facebook.com/docs/sharing/domain-verification")
    expect(detection.categories).toEqual(["Advertising", "Security"])
    expect(detection.bucket).toBe("business")
    expect(detection.iconUrl).toContain("Facebook.svg")
  })

  it("preserves generated Wappalyzer metadata when only custom icon metadata is present", () => {
    const detection = buildStructuredTechnologyDetection({
      name: "GSAP",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })

    expect(detection.description).toBe("GSAP is an animation library that allows you to create animations with JavaScript.")
    expect(detection.website).toBe("https://greensock.com/gsap")
    expect(detection.categories).toEqual(["JavaScript frameworks"])
    expect(detection.bucket).toBe("framework")
    expect(detection.iconUrl).toContain("simple-icons@latest/icons/greensock.svg")
  })

  it("overrides Amazon S3 metadata so object storage is not treated as a CDN", () => {
    const detection = buildStructuredTechnologyDetection({
      name: "Amazon S3",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })

    expect(detection.name).toBe("Amazon S3")
    expect(detection.description).toBe(
      "Amazon S3 or Amazon Simple Storage Service is a service offered by Amazon Web Services (AWS) that provides object storage through a web service interface.",
    )
    expect(detection.categories).toEqual(["Network storage"])
    expect(detection.bucket).toBe("infrastructure")
    expect(detection.iconUrl).toContain("Amazon%20S3.svg")
  })
})
