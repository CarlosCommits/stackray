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

  it("detects Cloudflare Workers from runtime markers and workers.dev resources", () => {
    const cloudflareWorkers = customFingerprints.apps["Cloudflare Workers"]

    expect(cloudflareWorkers.cats).toEqual([62])
    expect(cloudflareWorkers.headers).toEqual({
      "x-powered-by": "^Cloudflare Workers$",
      "x-runtime": "^Cloudflare Workers$",
    })
    expect(cloudflareWorkers.meta).toEqual({
      runtime: ["^Cloudflare Workers$"],
    })
    expect(cloudflareWorkers.html).toEqual(
      expect.arrayContaining([
        "<meta[^>]+name=[\"']runtime[\"'][^>]+content=[\"']Cloudflare Workers[\"']",
        "<meta[^>]+content=[\"']Cloudflare Workers[\"'][^>]+name=[\"']runtime[\"']",
        "https?:\\/\\/[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.workers\\.dev\\b",
      ]),
    )
    expect(cloudflareWorkers.scriptSrc).toEqual([
      "https?:\\/\\/[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.workers\\.dev\\b",
    ])
    expect(cloudflareWorkers.implies).toEqual(["Cloudflare"])
  })

  it("detects CI and data infrastructure tools from explicit public markers", () => {
    const circleCi = customFingerprints.apps.CircleCI
    const dagster = customFingerprints.apps.Dagster
    const fivetran = customFingerprints.apps.Fivetran
    const openSearch = customFingerprints.apps.OpenSearch
    const terraform = customFingerprints.apps.Terraform

    expect(circleCi.cats).toEqual([44])
    expect(circleCi.html).toEqual(
      expect.arrayContaining([
        expect.stringContaining("circleci\\.com\\/(?:status-badge\\/img\\/)?(?:gh|bb)"),
        expect.stringContaining("app\\.circleci\\.com\\/pipelines"),
      ]),
    )

    expect(dagster.cats).toEqual([47])
    expect(dagster.html).toEqual(
      expect.arrayContaining([
        expect.stringContaining("id=[\"']initialization-data"),
        expect.stringContaining("window\\.__webpack_public_path__"),
        "\\bdagster_(?:webserver|graphql)_version\\b",
      ]),
    )
    expect(dagster.scriptSrc).toEqual(["https?:\\/\\/dagster\\.io\\/oss-telemetry\\.js"])

    expect(fivetran.cats).toEqual([97, 47])
    expect(fivetran.headers).toEqual({
      "fivetran-signature": "",
      "x-fivetran-signature": "",
    })
    expect(fivetran.html).toEqual(expect.arrayContaining(["https?:\\/\\/api\\.fivetran\\.com\\/v1\\/"]))

    expect(openSearch.cats).toEqual([29, 34])
    expect(openSearch.html).toEqual(
      expect.arrayContaining([
        "\"tagline\"\\s*:\\s*\"The OpenSearch Project: https:\\/\\/opensearch\\.org\\/\"",
        "\"distribution\"\\s*:\\s*\"opensearch\"",
        "<osd-injected-metadata\\b",
        "\\b__osdBootstrap__\\b",
      ]),
    )
    expect(openSearch.js).toEqual({ __osdBootstrap__: "" })

    expect(terraform.cats).toEqual([47, 62])
    expect(terraform.headers).toEqual({
      "x-tfe-notification-signature": "",
      "x-terraform-version": "",
    })
    expect(terraform.html).toEqual(
      expect.arrayContaining([
        "https?:\\/\\/app\\.terraform\\.io\\/(?:app|api)\\/",
        "\\bX-TFE-Notification-Signature\\b",
      ]),
    )
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

  it("detects browser-sweep frontend frameworks and widgets from conservative runtime signals", () => {
    const cloudflareTurnstile = customFingerprints.apps["Cloudflare Turnstile"]
    const solid = customFingerprints.apps.SolidJS
    const chatwoot = customFingerprints.apps.Chatwoot
    const ionicons = customFingerprints.apps.Ionicons
    const storyteller = customFingerprints.apps.Storyteller
    const unicornStudio = customFingerprints.apps["Unicorn Studio"]

    expect(cloudflareTurnstile.cats).toEqual([16])
    expect(cloudflareTurnstile.scriptSrc).toEqual([
      expect.stringContaining("challenges\\.cloudflare\\.com\\/turnstile"),
    ])
    expect(cloudflareTurnstile.dom).toHaveProperty("input[name=\"cf-turnstile-response\"]")
    expect(cloudflareTurnstile.implies).toEqual(["Cloudflare"])

    expect(solid.cats).toEqual([12])
    expect(solid.scripts).toEqual(
      expect.arrayContaining([
        "\\bglobalThis\\.\\$HY\\b",
        "\\b_\\$HY\\.done\\b",
      ]),
    )

    expect(chatwoot.cats).toEqual([52])
    expect(chatwoot.js).toEqual({ chatwootSettings: "" })
    expect(chatwoot.html).toEqual(expect.arrayContaining(["\\bwindow\\.chatwootSettings\\b", "\\bbootChatwoot\\b"]))

    expect(ionicons.cats).toEqual([17])
    expect(ionicons.scriptSrc).toEqual([
      expect.stringContaining("\\/ionicons@"),
    ])

    expect(storyteller.cats).toEqual([14])
    expect(storyteller.dom).toHaveProperty("[storyteller-view-id]")
    expect(storyteller.html).toEqual(expect.arrayContaining([expect.stringContaining("usestoryteller")]))

    expect(unicornStudio.cats).toEqual([5])
    expect(unicornStudio.scriptSrc).toEqual([
      expect.stringContaining("hiunicornstudio"),
    ])
  })

  it("detects browser-sweep analytics, ads, and identity tools from exact vendor signals", () => {
    const adobeLaunch = customFingerprints.apps["Adobe Experience Platform Launch"]
    const adobeWebSdk = customFingerprints.apps["Adobe Experience Platform Web SDK"]
    const ahrefsAnalytics = customFingerprints.apps["Ahrefs Analytics"]
    const datadogRum = customFingerprints.apps["Datadog RUM"]
    const granify = customFingerprints.apps.Granify
    const pingOneDaVinci = customFingerprints.apps["PingOne DaVinci"]
    const postHog = customFingerprints.apps.PostHog
    const rudderStack = customFingerprints.apps.RudderStack
    const snapPixel = customFingerprints.apps["Snap Pixel"]

    expect(adobeLaunch.cats).toEqual([42])
    expect(adobeLaunch.scriptSrc).toEqual([
      expect.stringContaining("assets\\.adobedtm\\.com"),
    ])

    expect(adobeWebSdk.cats).toEqual([97])
    expect(adobeWebSdk.cookies).toEqual({ "kndctr_[A-Z0-9]+_AdobeOrg_identity": "" })
    expect(adobeWebSdk.scriptSrc).toEqual([
      expect.stringContaining("\\/adobe\\/alloy\\.min\\.js"),
    ])

    expect(ahrefsAnalytics.cats).toEqual([10])
    expect(ahrefsAnalytics.scriptSrc).toEqual(["https?:\\/\\/analytics\\.ahrefs\\.com\\/analytics\\.js"])

    expect(datadogRum.cats).toEqual([10, 78])
    expect(datadogRum.cookies).toEqual({ _dd_s: "" })
    expect(datadogRum.implies).toEqual(["Datadog"])

    expect(granify.cats).toEqual([76])
    expect(granify.cookies).toEqual({ "granify.uuid": "" })
    expect(granify.js).toEqual({ Granify: "", GRANIFY_CONFIG: "", activateGranify: "" })

    expect(pingOneDaVinci.cats).toEqual([69])
    expect(pingOneDaVinci.scriptSrc).toEqual([
      expect.stringContaining("assets\\.pingone\\.com\\/davinci"),
    ])
    expect(pingOneDaVinci.js).toEqual({ davinci: "" })

    expect(postHog.cats).toEqual([10])
    expect(postHog.cookies).toEqual({ "ph_phc_[A-Za-z0-9_-]+_posthog": "" })
    expect(postHog.js).toEqual({
      __PosthogExtensions__: "",
      _POSTHOG_REMOTE_CONFIG: "",
      postHogWebVitalsCallbacks: "",
    })

    expect(rudderStack.cats).toEqual([97])
    expect(rudderStack.cookies).toEqual({
      rl_anonymous_id: "",
      rl_group_id: "",
      rl_session: "",
      rl_trait: "",
      rl_user_id: "",
    })

    expect(snapPixel.cats).toEqual([36])
    expect(snapPixel.scriptSrc).toEqual([
      expect.stringContaining("tr\\.snapchat\\.com\\/config"),
    ])
    expect(snapPixel.js).toEqual({ snaptr: "" })
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

  it("detects Intercom from official messenger runtime signals", () => {
    const intercom = customFingerprints.apps.Intercom

    expect(intercom.cats).toEqual([52, 53])
    expect(intercom.dom).toEqual({
      "div.live-chat-loader-placeholder": {
        exists: "",
      },
      "iframe#intercom-frame": {
        exists: "",
      },
      "link[href^='https://widget.intercom.io']": {
        exists: "",
      },
    })
    expect(intercom.html).toEqual(
      expect.arrayContaining([
        "(?:https?:)?\\/\\/[^\\s\"'<>]*\\b(?:intercom\\.io|intercomcdn\\.com)\\b",
        "\\bIntercom\\(['\"]boot['\"]",
        "\\bwindow\\.intercomSettings\\b",
        "https?:\\/\\/widget\\.intercom\\.io\\/widget\\/[A-Za-z0-9_-]+",
      ]),
    )
    expect(intercom.js).toEqual({
      Intercom: "",
      intercomSettings: "",
    })
    expect(intercom.scriptSrc).toEqual([
      "(?:https?:)?\\/\\/[^\\s\"'<>]*\\b(?:intercom\\.io|intercomcdn\\.com)\\b",
    ])
  })

  it("detects browser-runtime marketing and analytics tools from product-specific scripts", () => {
    const claydar = customFingerprints.apps.Claydar
    const factors = customFingerprints.apps["Factors.ai"]
    const eppo = customFingerprints.apps.Eppo
    const trackingplan = customFingerprints.apps.Trackingplan
    const termly = customFingerprints.apps.Termly
    const unify = customFingerprints.apps.Unify

    expect(claydar.cats).toEqual([10, 32])
    expect(claydar.scriptSrc).toEqual([
      "(?:https?:)?\\/\\/(?:static|cdn)\\.claydar\\.com\\/(?:init\\.v1\\.js|releases\\/latest\\/radar\\.min\\.js)",
    ])
    expect(claydar.js).toEqual({ Claydar: "" })
    expect(claydar.html).toEqual(expect.arrayContaining([expect.stringContaining("api\\.claydar\\.com")]))

    expect(factors.scriptSrc).toEqual(["https?:\\/\\/app\\.factors\\.ai\\/assets\\/factors\\.js"])
    expect(factors.html).toEqual(expect.arrayContaining([expect.stringContaining("api\\.factors\\.ai")]))
    expect(factors.js).toEqual({ factors: "" })

    expect(eppo.cats).toEqual([85, 74])
    expect(eppo.scriptSrc).toEqual([
      "(?:https?:)?\\/\\/[^\\s\"'<>]*\\/npm\\/@eppo\\/visual_editor_snippet@[\\w.+-]+\\/",
    ])
    expect(eppo.html).toEqual(expect.arrayContaining([expect.stringContaining("fscdn\\.eppo\\.cloud")]))

    expect(trackingplan.html).toEqual(
      expect.arrayContaining([
        expect.stringContaining("config\\.trackingplan\\.com"),
        expect.stringContaining("Trackingplan\\.sdkVersion"),
      ]),
    )
    expect(trackingplan.js).toEqual({ Trackingplan: "" })

    expect(termly.cats).toEqual([67])
    expect(termly.scriptSrc).toEqual(["https?:\\/\\/app\\.termly\\.io\\/resource-blocker\\/[0-9a-f-]+"])
    expect(termly.js).toEqual({
      TERMLY_RESOURCE_BLOCKER_LOADED: "",
      Termly: "",
      termlyUnblockingCookies: "",
    })

    expect(unify.cats).toEqual([97, 32])
    expect(unify.cookies).toEqual({
      unify_session_id: "",
      unify_visitor_id: "",
    })
    expect(unify.scriptSrc).toEqual(["https?:\\/\\/tag\\.unifyintent\\.com\\/v1\\/[^\\s\"'<>]+\\/script\\.js"])
  })

  it("detects browser-runtime experimentation, ad, attribution, and video tools from stable signals", () => {
    const statsig = customFingerprints.apps.Statsig
    const sixSense = customFingerprints.apps["6sense"]
    const adRoll = customFingerprints.apps.AdRoll
    const g2 = customFingerprints.apps.G2
    const logRocket = customFingerprints.apps.LogRocket
    const yahooAdvertising = customFingerprints.apps["Yahoo Advertising"]
    const googleAdsConversionTracking = customFingerprints.apps["Google Ads Conversion Tracking"]
    const hls = customFingerprints.apps["hls.js"]
    const splitType = customFingerprints.apps.SplitType

    expect(statsig.js).toEqual({ __STATSIG__: "" })
    expect(statsig.scripts).toEqual(["\\bstatsig\\.(?:cached\\.evaluations|stable_id|session_id)\\b"])

    expect(sixSense.scriptSrc).toEqual(["(?:https?:)?\\/\\/j\\.6sc\\.co\\/(?:6si\\.min\\.js|j\\/[a-f0-9-]+\\.js)"])
    expect(sixSense.html).toEqual(expect.arrayContaining(["id=[\"']6senseWebTag[\"']"]))

    expect(adRoll.scriptSrc).toEqual(["(?:https?:)?\\/\\/s\\.adroll\\.com\\/j\\/[^\\s\"'<>]+\\/roundtrip\\.js"])
    expect(adRoll.cookies).toEqual({ __adroll_fpc: "" })

    expect(g2.scriptSrc).toEqual([
      "(?:https?:)?\\/\\/tracking\\.g2crowd\\.com\\/attribution_tracking\\/conversions\\/\\d+\\.js",
    ])
    expect(logRocket.scriptSrc).toEqual(["(?:https?:)?\\/\\/cdn\\.lr-in-prod\\.com\\/logger-1\\.min\\.js"])
    expect(yahooAdvertising.scriptSrc).toEqual(["(?:https?:)?\\/\\/s\\.yimg\\.com\\/wi\\/ytc\\.js"])
    expect(googleAdsConversionTracking.cats).toEqual([10])
    expect(googleAdsConversionTracking.scriptSrc).toEqual([
      "(?:https?:)?\\/\\/www\\.googletagmanager\\.com\\/gtag\\/js\\?id=AW-\\d+",
    ])
    expect(googleAdsConversionTracking.html).toEqual(
      expect.arrayContaining([
        "(?:https?:)?\\/\\/googleads\\.g\\.doubleclick\\.net\\/pagead\\/(?:viewthrough)?conversion\\/",
      ]),
    )

    expect(hls.cats).toEqual([14])
    expect(hls.scriptSrc).toEqual(["(?:https?:)?\\/\\/[^\\s\"'<>]*\\/npm\\/hls\\.js@[\\w.+-]+(?:\\/|$)"])
    expect(splitType.cats).toEqual([59])
    expect(splitType.scriptSrc).toEqual(["(?:https?:)?\\/\\/[^\\s\"'<>]*\\/npm\\/split-type@[\\w.+-]+\\/"])
  })

  it("detects BuiltWith-led runtime misses from live public evidence", () => {
    const crazyEgg = customFingerprints.apps["Crazy Egg"]
    const visitorAnalytics = customFingerprints.apps["Visitor Analytics"]
    const floodlight = customFingerprints.apps["DoubleClick Floodlight"]
    const parseLy = customFingerprints.apps["Parse.ly"]
    const adobeHelixRum = customFingerprints.apps["Adobe Helix RUM"]
    const kasada = customFingerprints.apps.Kasada
    const tealium = customFingerprints.apps.Tealium
    const medallia = customFingerprints.apps.Medallia
    const fullStory = customFingerprints.apps.FullStory
    const jscrambler = customFingerprints.apps.Jscrambler
    const requireJs = customFingerprints.apps.RequireJS
    const newRelic = customFingerprints.apps["New Relic"]
    const pinterestConversionTag = customFingerprints.apps["Pinterest Conversion Tag"]
    const tiktokPixel = customFingerprints.apps["TikTok Pixel"]
    const modelViewer = customFingerprints.apps["<model-viewer>"]

    expect(crazyEgg.html).toEqual([
      "(?:https?:\\/\\/)?script\\.crazyegg\\.com\\/pages\\/scripts\\/[0-9/]+\\.js(?:\\?|$)",
    ])
    expect(visitorAnalytics.scriptSrc).toEqual(["https?:\\/\\/app-worker\\.visitor-analytics\\.io\\/main\\.js"])
    expect(floodlight.scriptSrc).toEqual([
      "https?:\\/\\/www\\.googletagmanager\\.com\\/gtag\\/js\\?id=DC-\\d+",
    ])

    expect(parseLy.dom).toHaveProperty("script.wp-parsely-metadata")
    expect(parseLy.html).toEqual(expect.arrayContaining([expect.stringContaining("parsely-cfg")]))

    expect(adobeHelixRum.cats).toEqual([10, 78])
    expect(adobeHelixRum.scriptSrc).toEqual(
      expect.arrayContaining([expect.stringContaining("rum\\.hlx\\.page\\/\\.rum\\/@adobe\\/helix-rum-js")]),
    )

    expect(kasada.html).toEqual([expect.stringContaining("\\bKPSDK\\b")])

    expect(tealium.js).toEqual({ utag: "" })
    expect(tealium.scriptSrc).toEqual(
      expect.arrayContaining([
        expect.stringContaining("\\.tiqcdn\\.com\\/utag\\/"),
        expect.stringContaining("\\/utag\\/"),
      ]),
    )

    expect(medallia.js).toEqual({
      _fs_medallia_feedback_registered: "",
      medallia_ab: "",
    })
    expect(medallia.scriptSrc).toEqual(
      expect.arrayContaining([expect.stringContaining("digital-cloud\\.medallia\\.com")]),
    )

    expect(fullStory.dom).toHaveProperty("fullstory-capture[data-fs-script-domain]")
    expect(jscrambler.html).toEqual([
      "https?(?::\\/\\/|:\\\\x2F\\\\x2F)[^\\s\"'<>]+\\.jscrambler\\.com(?:\\/|\\\\x2F)cc(?:\\/|\\\\x2F)\\d+\\.js",
    ])

    expect(requireJs.js).toEqual({ requirejs: "" })
    expect(requireJs.scripts).toEqual(["\\brequirejs\\.config\\("])

    expect(newRelic.js).toEqual({ NREUM: "" })
    expect(newRelic.scripts).toEqual(expect.arrayContaining(["\\bNREUM\\.init\\b"]))

    expect(pinterestConversionTag.js).toEqual({ pintrk: "" })
    expect(pinterestConversionTag.scripts).toEqual(expect.arrayContaining(["\\bpintrk\\.queue\\b"]))

    expect(tiktokPixel.js).toEqual({ ttq: "" })
    expect(tiktokPixel.scripts).toEqual(expect.arrayContaining(["\\bttq\\.methods\\b"]))

    expect(modelViewer.cats).toEqual([105])
    expect(modelViewer.dom).toHaveProperty("model-viewer")
    expect(modelViewer.scriptSrc).toEqual([
      expect.stringContaining("ajax\\.googleapis\\.com\\/ajax\\/libs\\/model-viewer"),
      expect.stringContaining("\\/npm\\/@google\\/model-viewer@"),
    ])
  })
})
