import { describe, expect, it } from "vitest"

import customFingerprints from "./custom-wappalyzer-fingerprints.json" with { type: "json" }
import { buildStructuredTechnologyDetection } from "./technology-metadata-catalog.ts"

describe("custom Wappalyzer fingerprints", () => {
  it("detects Clerk with conservative auth-specific signals", () => {
    const clerk = customFingerprints.apps.Clerk

    expect(clerk.cats).toEqual([69])
    expect(clerk.cookies).toEqual({ __client_uat: "" })
    expect(clerk.html).toEqual(
      expect.arrayContaining([
        expect.stringContaining("data-clerk-publishable-key"),
        expect.stringContaining("/npm/@clerk/(?:clerk-js|ui)"),
      ]),
    )
    expect(clerk.scriptSrc).toEqual([
      expect.stringContaining("/npm/@clerk/(?:clerk-js|ui)"),
    ])
    expect(clerk.js).toEqual({
      "Clerk.authenticateWithMetamask": "",
      "Clerk.openSignIn": "",
      "Clerk.version": "([\\d.]+)\\;version:\\1",
      __clerk_publishable_key: "",
    })
    expect(clerk.scripts).toEqual(["\\b__clerk_publishable_key\\b"])
  })

  it("detects Cloudflare Web Analytics from the official beacon snippet", () => {
    const cloudflareWebAnalytics = customFingerprints.apps["Cloudflare Web Analytics"]

    expect(cloudflareWebAnalytics.cats).toEqual([10, 78])
    expect(cloudflareWebAnalytics.html).toEqual(
      expect.arrayContaining([
        expect.stringContaining("data-cf-beacon"),
        expect.stringContaining("static\\.cloudflareinsights\\.com/beacon"),
      ]),
    )
    expect(cloudflareWebAnalytics.scriptSrc).toEqual([
      expect.stringContaining("static\\.cloudflareinsights\\.com/beacon"),
    ])
  })

  it("detects Shopify from headless and Storefront API bundle signals", () => {
    const shopify = customFingerprints.apps.Shopify

    expect(shopify.cats).toEqual([6, 1])
    expect(shopify.cookies).toEqual({
      _shopify_s: "",
      _shopify_y: "",
    })
    expect(shopify.headers).toEqual({
      "powered-by": "shopify",
      "x-shopid": "\\;confidence:50",
      "x-shopify-stage": "",
    })
    expect(shopify.html).toEqual(
      expect.arrayContaining([
        "\\bX-Shopify-Storefront-Access-Token\\b",
        "\\bgid:\\/\\/shopify\\/(?:Cart|Checkout|Collection|Product|ProductVariant)\\b",
        "\\/(?:api|actions)\\/shopify\\/(?:cart|checkout|product|products|collection|collections)\\b",
      ]),
    )
    expect(shopify.js).toEqual({
      SHOPIFY_API_BASE_URL: "",
      Shopify: "\\;confidence:25",
      ShopifyAPI: "",
      ShopifyCustomer: "",
    })
    expect(shopify.meta).toEqual({
      "shopify-checkout-api-token": [],
      "shopify-digital-wallet": [],
    })
    expect(shopify.scripts).toEqual(
      expect.arrayContaining([
        "shopifytag",
        "\\bX-Shopify-Storefront-Access-Token\\b",
        "\\bgid:\\/\\/shopify\\/(?:Cart|Checkout|Collection|Product|ProductVariant)\\b",
        "\\b@shopify\\/(?:hydrogen|shopify-api|storefront-api-client)\\b",
        "\\/(?:api|actions)\\/shopify\\/(?:cart|checkout|product|products|collection|collections)\\b",
        "\\bshopify[-_](?:cart|checkout|product|storefront)\\b",
        "\\bcart(?:Create|LinesAdd|LinesUpdate|LinesRemove)\\b[\\s\\S]{0,240}\\bcheckoutUrl\\b|\\bcheckoutUrl\\b[\\s\\S]{0,240}\\bcart(?:Create|LinesAdd|LinesUpdate|LinesRemove)\\b",
      ]),
    )
    expect(shopify.implies).toEqual([])
  })

  it("uses generated Wappalyzer metadata for Shopify", () => {
    const detection = buildStructuredTechnologyDetection({
      name: "Shopify",
      sources: ["wappalyzer"],
      inferred: false,
    })

    expect(detection.name).toBe("Shopify")
    expect(detection.description).toContain("subscription-based software")
    expect(detection.website).toBe("https://shopify.com")
    expect(detection.iconUrl).toBe("https://raw.githubusercontent.com/enthec/webappanalyzer/main/src/images/icons/Shopify.svg")
    expect(detection.categories).toEqual(["Ecommerce", "CMS"])
  })

  it("detects DataFast from official and proxied tracking scripts", () => {
    const dataFast = customFingerprints.apps.DataFast

    expect(dataFast.cats).toEqual([10])
    expect(dataFast.html).toEqual(
      expect.arrayContaining([
        expect.stringContaining("datafa\\.st\\/js\\/script"),
        expect.stringContaining("data-website-id"),
      ]),
    )
    expect(dataFast.scriptSrc).toEqual([
      expect.stringContaining("datafa\\.st\\/js\\/script"),
    ])
    expect(dataFast.scripts).toEqual([
      "\\bdatafast_(?:stripe|polar|lemonsqueezy)_payment_sent_",
      "\\bdatafast_(?:visitor|session)_id\\b",
    ])
  })

  it("detects Convex from deployment URLs exposed to the frontend", () => {
    const convex = customFingerprints.apps["Convex Backend"]

    expect(convex.cats).toEqual([34, 47])
    expect(convex.headers).toEqual({
      "content-security-policy": expect.stringContaining("convex\\.(?:cloud|site)"),
    })
    expect(convex.html).toEqual([
      "convex\\.cloud",
      "convex\\.site",
    ])
    expect(convex.scripts).toEqual([
      "convex\\.cloud",
      "convex\\.site",
    ])
  })

  it("detects Redis Backend only from explicit Redis frontend leaks or emitted cache markers", () => {
    const redis = customFingerprints.apps["Redis Backend"]

    expect(redis.cats).toEqual([34])
    expect(redis.html).toEqual([
      "<!--\\s*Performance optimized by Redis Object Cache",
      "\\bREDIS_URL\\b\\s*[:=]\\s*['\"]rediss?:\\/\\/",
      "\\bREDIS_TLS_URL\\b\\s*[:=]\\s*['\"]rediss?:\\/\\/",
    ])
    expect(redis.scripts).toEqual([
      "\\bREDIS_URL\\b\\s*[:=]\\s*['\"]rediss?:\\/\\/",
      "\\bREDIS_TLS_URL\\b\\s*[:=]\\s*['\"]rediss?:\\/\\/",
    ])
    expect(redis.implies).toEqual(["Redis"])
  })

  it("detects Upstash from Upstash Redis-specific frontend leaks", () => {
    const upstash = customFingerprints.apps.Upstash

    expect(upstash.cats).toEqual([34, 62])
    expect(upstash.html).toEqual([
      "\\bUPSTASH_REDIS_REST_URL\\b",
      "\\bUPSTASH_REDIS_REST_TOKEN\\b",
    ])
    expect(upstash.scripts).toEqual([
      "\\bUPSTASH_REDIS_REST_URL\\b",
      "\\bUPSTASH_REDIS_REST_TOKEN\\b",
      "\\b@upstash\\/redis\\b",
    ])
    expect(upstash.implies).toEqual(["Redis"])
  })

  it("detects Mux from player embeds and mux-player package URLs", () => {
    const mux = customFingerprints.apps.Mux

    expect(mux.cats).toEqual([10])
    expect(mux.html).toEqual(
      expect.arrayContaining([
        expect.stringContaining("player\\.mux\\.com"),
        expect.stringContaining("image\\.mux\\.com"),
        expect.stringContaining("/npm\\/@mux\\/mux-player@"),
      ]),
    )
    expect(mux.scriptSrc).toEqual([
      expect.stringContaining("/npm\\/@mux\\/mux-player@"),
    ])
  })

  it("detects Workday from tenant application and jobs URLs", () => {
    const workday = customFingerprints.apps.Workday

    expect(workday.cats).toEqual([53])
    expect(workday.html).toEqual([
      "www\\.myworkday\\.com",
      "wd[0-9]+\\.myworkday\\.com",
      "myworkdayjobs\\.com",
    ])
    expect(workday.scriptSrc).toEqual(workday.html)
    expect(workday.js).toEqual({
      "workday.appRoot": "",
      workdayMessages: "",
    })
  })

  it("detects React Redux from its bundled context symbol", () => {
    const reactRedux = customFingerprints.apps["React Redux"]

    expect(reactRedux.cats).toEqual([12])
    expect(reactRedux.scripts).toEqual(['Symbol\\.for\\(["\']react-redux-context["\']\\)'])
    expect(reactRedux.implies).toEqual(["React", "Redux"])
  })

  it("detects XTerm.js from exact package URLs", () => {
    const xterm = customFingerprints.apps["XTerm.js"]

    expect(xterm.cats).toEqual([59])
    expect(xterm.html).toEqual(
      expect.arrayContaining([
        expect.stringContaining("/npm\\/(?:@xterm\\/xterm|xterm)@"),
        expect.stringContaining("/npm\\/xterm-addon-"),
      ]),
    )
    expect(xterm.scriptSrc).toEqual(xterm.html)
  })
})
