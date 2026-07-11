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

  it("detects auth services from current cookies and SDK signals", () => {
    const authJs = customFingerprints.apps["Auth.js"]
    const betterAuth = customFingerprints.apps["Better Auth"]
    const firebaseAuth = customFingerprints.apps["Firebase Authentication"]
    const supabaseAuth = customFingerprints.apps["Supabase Auth"]
    const auth0 = customFingerprints.apps.Auth0

    expect(authJs.cats).toEqual([69])
    expect(authJs.cookies).toEqual({
      "__Host-authjs.csrf-token": "",
      "__Secure-authjs.callback-url": "",
      "__Secure-authjs.session-token": "",
      "authjs.callback-url": "",
      "authjs.csrf-token": "",
      "authjs.session-token": "",
    })
    expect(authJs.implies).toEqual(["Next.js"])

    expect(betterAuth.cats).toEqual([69])
    expect(betterAuth.cookies).toEqual({
      "__Secure-better-auth.session_token": "",
      "better-auth.last_used_login_method": "",
      "better-auth.session_data": "",
      "better-auth.session_token": "",
    })
    expect(betterAuth.scriptSrc).toEqual([expect.stringContaining("/npm\\/better-auth@")])
    expect(betterAuth.scripts).toEqual(expect.arrayContaining([
      "\\bbetter-auth\\.message\\b",
      "\\bbetter-auth\\.popup_token\\b",
    ]))

    expect(firebaseAuth.cats).toEqual([69])
    expect(firebaseAuth.scriptSrc).toEqual(expect.arrayContaining([
      expect.stringContaining("firebase-auth"),
      expect.stringContaining("/npm\\/firebase@"),
    ]))
    expect(firebaseAuth.scripts).toEqual(expect.arrayContaining([
      "\\bfrom\\s+[\"']firebase\\/auth[\"']",
    ]))
    expect(firebaseAuth.implies).toEqual(["Firebase"])

    expect(supabaseAuth.cats).toEqual([69])
    expect(supabaseAuth.cookies).toEqual({
      "sb-access-token": "",
      "sb-refresh-token": "",
    })
    expect(supabaseAuth.headers).toEqual({
      "set-cookie": "(?:^|[;,\\s])sb-[a-z0-9]{20}-auth-token=",
    })
    expect(supabaseAuth.scripts).toEqual([
      expect.stringContaining("@supabase\\/supabase-js"),
    ])
    expect(supabaseAuth.implies).toEqual(["Supabase"])

    expect(auth0.cats).toEqual([69])
    expect(auth0.scriptSrc).toEqual(expect.arrayContaining([
      expect.stringContaining("auth0-spa-js"),
      "\\/auth0(?:-js)?\\/([\\d.]+)\\/auth0(?:.min)?\\.js\\;version:\\1",
    ]))
    expect(auth0.scripts).toEqual(expect.arrayContaining([
      "\\b@auth0\\/auth0-spa-js\\b",
      "\\bcreateAuth0Client\\(",
    ]))
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

  it("detects OpenAI Conversion Tracking from official tracking endpoints", () => {
    const openAiConversionTracking = customFingerprints.apps["OpenAI Conversion Tracking"]

    expect(openAiConversionTracking.cats).toEqual([10, 36])
    expect(openAiConversionTracking.html).toEqual([
      "https?:\\/\\/bzrcdn\\.openai\\.com\\/sdk\\/oaiq\\.min\\.js",
      "https?:\\/\\/bzr\\.openai\\.com\\/v1\\/sdk\\/events\\b",
    ])
    expect(openAiConversionTracking.scriptSrc).toEqual([
      "https?:\\/\\/bzrcdn\\.openai\\.com\\/sdk\\/oaiq\\.min\\.js",
    ])
    expect(openAiConversionTracking.implies).toEqual(["OpenAI"])
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

  it("detects Google Cloud Functions from cloudfunctions.net API references", () => {
    const googleCloudFunctions = customFingerprints.apps["Google Cloud Functions"]

    expect(googleCloudFunctions.cats).toEqual([62])
    expect(googleCloudFunctions.html).toEqual([
      "https?:\\/\\/[a-z0-9][a-z0-9-]*\\.cloudfunctions\\.net\\b",
    ])
    expect(googleCloudFunctions.scripts).toEqual([
      "https?:\\/\\/[a-z0-9][a-z0-9-]*\\.cloudfunctions\\.net\\b",
    ])
    expect(googleCloudFunctions.implies).toEqual(["Google Cloud"])
  })

  it("detects CI and data infrastructure tools from explicit public markers", () => {
    const circleCi = customFingerprints.apps.CircleCI
    const dagster = customFingerprints.apps.Dagster
    const fivetran = customFingerprints.apps.Fivetran
    const elasticsearch = customFingerprints.apps.Elasticsearch
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

    expect(elasticsearch.cats).toEqual([29, 34])
    expect(elasticsearch.headers).toEqual({ "x-elastic-product": "^Elasticsearch$" })
    expect(elasticsearch.html).toEqual(expect.arrayContaining([
      "\"tagline\"\\s*:\\s*\"You Know, for Search\"",
      expect.stringContaining("\"lucene_version\""),
    ]))

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

  it("detects ORMs and database mapping libraries from exact public package and API evidence", () => {
    const apps = customFingerprints.apps as Record<string, {
      cats?: number[]
      implies?: string[]
      scripts?: string[]
      scriptSrc?: string[]
    }>
    const ormNames = [
      "Prisma",
      "Drizzle ORM",
      "TypeORM",
      "Sequelize",
      "Mongoose",
      "MikroORM",
      "Knex.js",
      "Objection.js",
      "Bookshelf.js",
      "Waterline",
      "Kysely",
      "SQLAlchemy",
      "Django ORM",
      "Peewee",
      "Tortoise ORM",
      "Active Record",
      "Eloquent ORM",
      "Doctrine ORM",
      "Entity Framework Core",
      "Hibernate ORM",
      "GORM",
      "Ent",
      "Diesel",
      "SeaORM",
      "Ecto",
    ]

    for (const name of ormNames) {
      expect(apps[name], name).toBeDefined()
      expect(apps[name]?.cats).toContain(34)
    }

    expect(apps.Prisma?.scripts).toEqual(expect.arrayContaining([
      "\\b@prisma\\/client\\b",
      "\\bnew\\s+PrismaClient\\(",
    ]))
    expect(apps.Prisma?.scriptSrc).toEqual([
      expect.stringContaining("/npm\\/@prisma\\/client@"),
    ])

    expect(apps["Drizzle ORM"]?.scripts).toEqual(expect.arrayContaining([
      "\\bfrom\\s+[\"']drizzle-orm[\"']",
      expect.stringContaining("drizzle-orm"),
    ]))
    expect(apps.Mongoose?.implies).toEqual(["MongoDB", "Node.js"])
    expect(apps["Objection.js"]?.implies).toEqual(["Knex.js", "Node.js"])

    expect(apps.SQLAlchemy?.scripts).toEqual(expect.arrayContaining([
      "\\bfrom\\s+sqlalchemy\\s+import\\s+(?:create_engine|Column|select)\\b",
    ]))
    expect(apps["Entity Framework Core"]?.scripts).toEqual(expect.arrayContaining([
      "\\bMicrosoft\\.EntityFrameworkCore\\b",
    ]))
    expect(apps.GORM?.scripts).toEqual(expect.arrayContaining([
      "\\bgorm\\.io\\/gorm\\b",
    ]))
    expect(apps.SeaORM?.scripts).toEqual(expect.arrayContaining([
      "\\bsea_orm::(?:entity::prelude|Database|EntityTrait|ActiveModelTrait)\\b",
    ]))
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
        "\\bcart(?:Create|LinesAdd|LinesUpdate|LinesRemove)\\b[\\s\\S]{0,240}\\bcheckoutUrl\\b|\\bcheckoutUrl\\b[\\s\\S]{0,240}\\bcart(?:Create|LinesAdd|LinesUpdate|LinesRemove)\\b",
      ]),
    )
    const domRecorderBundle = '"shopify-checkout-api-token"===getAttribute(element,"name")'
    expect(shopify.scripts.some((pattern) => new RegExp(pattern, "i").test(domRecorderBundle))).toBe(false)
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

  it("detects Sentry from official browser SDK, loader, and CDN signals", () => {
    const sentry = customFingerprints.apps.Sentry

    expect(sentry.cats).toEqual([13])
    expect(sentry.headers).toEqual({
      "content-security-policy": "(?:^|[\\s;])https?:\\/\\/(?:[^\\s;]*\\.)?(?:sentry\\.io|sentry-cdn\\.com)\\b",
    })
    expect(sentry.js).toEqual({
      "Raven.config": "",
      Sentry: "",
      "Sentry.SDK_VERSION": "(.+)\\;version:\\1",
      "SENTRY_RELEASE.id": "",
      __SENTRY__: "",
      "ravenOptions.whitelistUrls": "",
      sentryOnLoad: "",
    })
    expect(sentry.html).toEqual(expect.arrayContaining([
      expect.stringContaining("browser\\.sentry-cdn\\.com"),
      expect.stringContaining("js\\.sentry-cdn\\.com"),
      expect.stringContaining("ingest\\."),
      expect.stringContaining("(?:envelope|store|security|csp-report|nel)"),
      "\\b@sentry\\/browser\\b",
      "\\bSentry\\.init\\(",
      "\\bwindow\\.SENTRY_RELEASE\\b",
      "\\bwindow\\.sentryOnLoad\\b",
      "\\b__SENTRY__\\b",
      "\\bRaven\\.config\\(",
    ]))
    expect(sentry.scriptSrc).toEqual([
      expect.stringContaining("browser\\.sentry-cdn\\.com"),
      expect.stringContaining("js\\.sentry-cdn\\.com"),
    ])
    expect(sentry.scripts).toEqual(expect.arrayContaining([
      "\\b@sentry\\/browser\\b",
      "\\bSentry\\.init\\(",
      "\\bwindow\\.SENTRY_RELEASE\\b",
      "\\bwindow\\.sentryOnLoad\\b",
      expect.stringContaining("ingest\\."),
      expect.stringContaining("(?:envelope|store|security|csp-report|nel)"),
    ]))
    expect(sentry.implies).toEqual([])
  })

  it("detects backend frameworks from conservative public signatures", () => {
    const fastify = customFingerprints.apps.Fastify
    const nestJs = customFingerprints.apps.NestJS
    const hapi = customFingerprints.apps.Hapi
    const elysia = customFingerprints.apps.Elysia
    const restify = customFingerprints.apps.Restify
    const fastApi = customFingerprints.apps.FastAPI
    const django = customFingerprints.apps.Django
    const springBoot = customFingerprints.apps["Spring Boot"]
    const aspNetCore = customFingerprints.apps["ASP.NET Core"]
    const gin = customFingerprints.apps.Gin
    const fiber = customFingerprints.apps.Fiber
    const phoenix = customFingerprints.apps.Phoenix
    const axum = customFingerprints.apps.Axum
    const python = customFingerprints.apps.Python
    const go = customFingerprints.apps.Go
    const echo = customFingerprints.apps.Echo
    const bskyweb = customFingerprints.apps.bskyweb
    const chi = customFingerprints.apps.Chi
    const buffalo = customFingerprints.apps.Buffalo
    const sinatraFramework = customFingerprints.apps["Sinatra Framework"]

    expect(fastify.cats).toEqual([18, 22])
    expect(fastify.headers).toEqual({ "x-powered-by": "^fastify$" })
    expect(fastify.html).toEqual([
      expect.stringContaining("Route (?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)"),
    ])

    expect(nestJs.cats).toEqual([18])
    expect(nestJs.html).toEqual([
      expect.stringContaining("Cannot (?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)"),
    ])

    expect(hapi.headers).toEqual({
      server: "^hapi(?:\\.js)?$",
      "x-powered-by": "^hapi(?:\\.js)?$",
    })
    expect(elysia.headers).toEqual({
      server: "^Elysia(?:$|[\\/\\s])",
      "x-powered-by": "^Elysia$",
    })
    expect(restify.headers).toEqual({
      server: "^restify(?:$|[\\/\\s])",
      "x-powered-by": "^restify$",
    })

    expect(fastApi.dom).toEqual({
      "link[href*='fastapi.tiangolo.com'][rel='shortcut icon']": {
        exists: "",
      },
    })
    expect(fastApi.html).toContain("https?:\\/\\/fastapi\\.tiangolo\\.com\\/img\\/favicon\\.png")

    expect(django.cookies).toEqual({
      csrftoken: "",
      django_language: "",
    })
    expect(django.html).toContain("\\bcsrfmiddlewaretoken\\b")
    expect(django.js).toEqual({
      "__admin_media_prefix__": "",
      django: "",
    })

    expect(springBoot.headers).toEqual({ "x-application-context": "" })
    expect(springBoot.html).toEqual([
      "<h1>Whitelabel Error Page<\\/h1>",
      "This application has no explicit mapping for \\/error",
    ])

    expect(aspNetCore.cookies).toEqual({
      "\\.AspNetCore\\.(?:Session|Cookies|Antiforgery\\.[A-Za-z0-9_-]+)": "",
    })
    expect(aspNetCore.headers).toEqual({
      server: "^Kestrel$",
      "x-powered-by": "^ASP\\.NET(?: Core)?$",
    })

    expect(gin.headers).toEqual({
      server: "^gin(?:$|[\\/\\s])",
      "x-powered-by": "^gin$",
    })
    expect(fiber.headers).toEqual({
      server: "^Fiber(?:$|[\\/\\s])",
      "x-powered-by": "^Fiber$",
    })
    expect(phoenix.dom).toEqual({
      "[data-phx-main], [data-phx-session], [data-phx-static]": {
        exists: "",
      },
    })
    expect(phoenix.html).toEqual(expect.arrayContaining([
      "\\bdata-phx-(?:main|session|static)=",
      "\\/live\\/websocket",
    ]))
    expect(axum.headers).toEqual({
      server: "^axum(?:$|[\\/\\s])",
      "x-powered-by": "^axum$",
    })

    expect(python.cats).toEqual([27])
    expect(python.headers).toEqual({
      server: "^(?:CPython|Python)(?:\\/[\\d.]+)?(?:$|[\\s;])",
      "x-powered-by": "^Python(?:\\/[\\d.]+)?(?:$|[\\s;])",
    })

    expect(go.cats).toEqual([27])
    expect(go.headers).toEqual({
      server: "^(?:Go|Go-http-server)(?:$|[\\/\\s])",
      "x-powered-by": "^Go$",
    })

    expect(echo.headers).toEqual({
      server: "^Echo(?:$|[\\/\\s])",
      "x-powered-by": "^Echo$",
    })
    expect(echo.implies).toEqual(["Go"])

    expect(bskyweb.cats).toEqual([18, 22])
    expect(bskyweb.meta).toEqual({ generator: ["^bskyweb$"] })
    expect(bskyweb.html).toEqual(expect.arrayContaining([
      "<meta[^>]+name=[\"']generator[\"'][^>]+content=[\"']bskyweb[\"']",
      "\\bTHIS NEEDS TO BE DUPLICATED IN `bskyweb\\/templates\\/base\\.html`",
    ]))
    expect(bskyweb.scriptSrc).toEqual([
      "https?:\\/\\/web-cdn\\.bsky\\.app\\/static\\/js\\/",
    ])
    expect(bskyweb.implies).toEqual(["Echo", "Go"])

    expect(chi.headers).toEqual({
      server: "^chi(?:$|[\\/\\s])",
      "x-powered-by": "^chi$",
    })
    expect(chi.implies).toEqual(["Go"])

    expect(buffalo.cookies).toEqual({ _buffalo_session: "" })
    expect(buffalo.headers).toEqual({
      server: "^Buffalo(?:$|[\\/\\s])",
      "x-powered-by": "^Buffalo$",
    })
    expect(buffalo.implies).toEqual(["Go"])

    expect(sinatraFramework.headers).toEqual({
      server: "^Sinatra(?:$|[\\/\\s])",
      "x-powered-by": "^Sinatra$",
    })
    expect(sinatraFramework.html).toEqual([
      "<h1>Sinatra doesn(?:'|&#39;)t know this ditty\\.<\\/h1>",
    ])
    expect(sinatraFramework.implies).toEqual(["Ruby"])
  })

  it("detects browser-sweep frontend frameworks and widgets from conservative runtime signals", () => {
    const cloudflareTurnstile = customFingerprints.apps["Cloudflare Turnstile"]
    const qwik = customFingerprints.apps.Qwik
    const htmx = customFingerprints.apps.Htmx
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

    expect(qwik.cats).toEqual([18])
    expect(qwik.dom["*"].attributes).toEqual(expect.objectContaining({
      "q:container": "",
      "q:manifest-hash": "",
      "q:version": "^([\\d\\.]+(?:-\\d+)?)\\;version:\\1",
    }))

    expect(htmx.cats).toEqual([59])
    expect(htmx.dom).toHaveProperty("[hx-get], [hx-post], [hx-put], [hx-delete], [hx-boost], [hx-target], [hx-swap], [data-hx-get], [data-hx-post], [data-hx-put], [data-hx-delete], [data-hx-boost], [data-hx-target], [data-hx-swap]")
    expect(htmx.html).toContain("\\b(?:hx|data-hx)-(?:get|post|put|delete|boost|target|swap)=")

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

  it("detects realtime, notifications, communications, and payment widgets from vendor-specific signals", () => {
    const ably = customFingerprints.apps.Ably
    const socketIo = customFingerprints.apps["Socket.io"]
    const liveblocks = customFingerprints.apps.Liveblocks
    const yjs = customFingerprints.apps.Yjs
    const partyKit = customFingerprints.apps.PartyKit
    const novu = customFingerprints.apps.Novu
    const twilio = customFingerprints.apps.Twilio
    const lemonSqueezy = customFingerprints.apps["Lemon Squeezy"]

    expect(socketIo.cats).toEqual([12])
    expect(socketIo.scriptSrc).toEqual(expect.arrayContaining([
      expect.stringContaining("socket\\.io-client@"),
      expect.stringContaining("socket\\.io"),
    ]))
    expect(socketIo.js).toEqual({ "io.Socket": "" })

    expect(ably.cats).toEqual([52])
    expect(ably.scriptSrc).toEqual(expect.arrayContaining([
      expect.stringContaining("cdn\\.ably"),
      expect.stringContaining("/npm\\/ably@"),
    ]))
    expect(ably.js).toEqual({
      "Ably.Realtime": "",
      "Ably.Rest": "",
    })

    expect(liveblocks.cats).toEqual([52, 59])
    expect(liveblocks.scripts).toEqual(expect.arrayContaining([
      "\\b@liveblocks\\/(?:client|react|react-ui)\\b",
      "\\bliveblocks\\.config\\b",
    ]))
    expect(liveblocks.implies).toEqual(["React"])

    expect(yjs.cats).toEqual([59])
    expect(yjs.js).toEqual({ "Y.Doc": "" })
    expect(yjs.scripts).toEqual(expect.arrayContaining([
      "\\bnew\\s+Y\\.Doc\\(",
      "\\bfrom\\s+[\"']yjs[\"']",
    ]))

    expect(partyKit.cats).toEqual([52])
    expect(partyKit.html).toEqual(expect.arrayContaining([
      expect.stringContaining("partykit\\.dev"),
    ]))

    expect(novu.cats).toEqual([52])
    expect(novu.scripts).toEqual(expect.arrayContaining([
      "\\b@novu\\/(?:js|notification-center|client)\\b",
      "\\bnew\\s+Novu\\(",
    ]))
    expect(novu.css).toEqual([expect.stringContaining("nv-notificationList")])

    expect(twilio.cats).toEqual([75])
    expect(twilio.scriptSrc).toEqual([expect.stringContaining("twiliocdn")])
    expect(twilio.js).toEqual({
      "Twilio.Device": "",
      "Twilio.Video": "",
    })

    expect(lemonSqueezy.cats).toEqual([41])
    expect(lemonSqueezy.html).toEqual(expect.arrayContaining([
      expect.stringContaining("app\\.lemonsqueezy\\.com"),
      "\\bdata-lemonsqueezy-(?:variant|discount|checkout)\\b",
    ]))
    expect(lemonSqueezy.js).toEqual({ LemonSqueezy: "" })
  })

  it("detects client libraries and AI SDKs from package-level runtime evidence", () => {
    const lit = customFingerprints.apps.Lit
    const reactHookForm = customFingerprints.apps["React Hook Form"]
    const zod = customFingerprints.apps.Zod
    const valibot = customFingerprints.apps.Valibot
    const yup = customFingerprints.apps.Yup
    const formik = customFingerprints.apps.Formik
    const jotai = customFingerprints.apps.Jotai
    const recoil = customFingerprints.apps.Recoil
    const swr = customFingerprints.apps.SWR
    const apolloClient = customFingerprints.apps["Apollo Client"]
    const vercelAiSdk = customFingerprints.apps["Vercel AI SDK"]
    const langChain = customFingerprints.apps.LangChain
    const llamaIndex = customFingerprints.apps.LlamaIndex
    const openAiSdk = customFingerprints.apps["OpenAI SDK"]
    const anthropicSdk = customFingerprints.apps["Anthropic SDK"]
    const mastra = customFingerprints.apps.Mastra

    expect(lit.cats).toEqual([59])
    expect(lit.scriptSrc).toEqual(expect.arrayContaining([
      expect.stringContaining("(?:lit|lit-html|lit-element)@"),
      expect.stringContaining("unpkg\\.com"),
    ]))
    expect(lit.scripts).toEqual(expect.arrayContaining([
      "\\bfrom\\s+[\"'](?:lit|lit-html|lit-element)[\"']",
    ]))

    expect(reactHookForm.implies).toEqual(["React"])
    expect(reactHookForm.scriptSrc).toEqual([expect.stringContaining("/npm\\/react-hook-form@")])
    expect(zod.scripts).toEqual(expect.arrayContaining([
      "\\b(?:from\\s+[\"']zod[\"']|require\\([\"']zod[\"']\\))",
    ]))
    expect(valibot.scriptSrc).toEqual([expect.stringContaining("/npm\\/valibot@")])
    expect(yup.scripts).toEqual(expect.arrayContaining([
      "\\bValidationError\\b[\\s\\S]{0,160}\\b(?:inner|path|errors)\\b",
    ]))
    expect(formik.implies).toEqual(["React"])
    expect(jotai.implies).toEqual(["React"])
    expect(recoil.scripts).toEqual(expect.arrayContaining([
      "\\bRecoilRoot\\b[\\s\\S]{0,240}\\b(?:atom|selector)\\(",
    ]))
    expect(swr.scriptSrc).toEqual([expect.stringContaining("/npm\\/swr@")])

    expect(apolloClient.js).toEqual({
      "__APOLLO_CLIENT__": "",
      "__APOLLO_CLIENT__.version": "^(.+)$\\;version:\\1",
    })
    expect(apolloClient.dom).toEqual({
      "script#__APOLLO_STATE__": { exists: "" },
    })
    expect(apolloClient.implies).toEqual(["GraphQL", "React"])

    expect(vercelAiSdk.cats).toEqual([112, 59])
    expect(vercelAiSdk.scripts).toEqual(expect.arrayContaining([
      "\\b@ai-sdk\\/(?:react|ui-utils|provider-utils)\\b",
      "\\bfrom\\s+[\"']ai\\/react[\"']",
    ]))
    expect(vercelAiSdk.implies).toEqual(["Vercel"])

    expect(langChain.scripts).toEqual(expect.arrayContaining(["\\b@langchain\\/(?:core|openai|anthropic|community)\\b"]))
    expect(llamaIndex.scriptSrc).toEqual([expect.stringContaining("(?:llamaindex|@llamaindex\\/core)@")])
    expect(openAiSdk.implies).toEqual(["OpenAI"])
    expect(openAiSdk.scripts).toEqual(expect.arrayContaining([
      "\\b(?:APIConnectionError|APIUserAbortError|OpenAIError)\\b",
    ]))
    expect(anthropicSdk.implies).toEqual(["Anthropic"])
    expect(anthropicSdk.scripts).toEqual(expect.arrayContaining([
      "\\b(?:AnthropicError|APIConnectionError|APIUserAbortError)\\b",
    ]))
    expect(mastra.scriptSrc).toEqual([expect.stringContaining("/npm\\/@mastra\\/(?:core|client-js)@")])
  })

  it("detects browser-sweep analytics, ads, and identity tools from exact vendor signals", () => {
    const adobeLaunch = customFingerprints.apps["Adobe Experience Platform Launch"]
    const adobeWebSdk = customFingerprints.apps["Adobe Experience Platform Web SDK"]
    const ahrefsAnalytics = customFingerprints.apps["Ahrefs Analytics"]
    const datadogBrowserLogs = customFingerprints.apps["Datadog Browser Logs"]
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
    expect(datadogRum.js).toEqual({
      "DD_RUM.getInternalContext": "",
      "DD_RUM.init": "",
    })
    expect(datadogRum.html).toEqual(expect.arrayContaining([
      "@datadog\\/browser-rum",
      "datadogRum\\.init\\(",
      expect.stringContaining("datadog-rum"),
      expect.stringContaining("browser-intake-"),
    ]))
    expect(datadogRum.scriptSrc).toEqual([
      expect.stringContaining("datadog-rum"),
    ])
    expect(datadogRum.scriptSrc[0]).toContain("eu1")
    expect(datadogRum.scriptSrc[0]).toContain("datadog-rum(?:-slim)?")
    expect(datadogRum.scripts).toEqual(expect.arrayContaining([
      "@datadog\\/browser-rum",
      "DD_RUM\\.init\\(",
      expect.stringContaining("browser-intake-"),
    ]))
    expect(datadogRum.implies).toEqual(["Datadog"])

    expect(datadogBrowserLogs.cats).toEqual([10])
    expect(datadogBrowserLogs.js).toEqual({
      "DD_LOGS.init": "",
      "DD_LOGS.logger": "",
    })
    expect(datadogBrowserLogs.html).toEqual(expect.arrayContaining([
      "@datadog\\/browser-logs",
      "datadogLogs\\.init\\(",
      expect.stringContaining("datadog-logs"),
    ]))
    expect(datadogBrowserLogs.scriptSrc).toEqual([
      expect.stringContaining("datadog-logs"),
    ])
    expect(datadogBrowserLogs.scriptSrc[0]).toContain("eu1")
    expect(datadogBrowserLogs.implies).toEqual(["Datadog"])

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
    const mongodb = customFingerprints.apps["MongoDB Backend"]

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

    expect(mongodb.cats).toEqual([34])
    expect(mongodb.html).toEqual([
      "\\bMONGO(?:DB)?_(?:URI|URL)\\b\\s*[:=]\\s*['\"]mongodb(?:\\+srv)?:\\/\\/",
      "mongodb\\+srv:\\/\\/[^\\s\"'<>]+\\.mongodb\\.net\\b",
    ])
    expect(mongodb.scripts).toEqual(mongodb.html)
    expect(mongodb.implies).toEqual(["MongoDB"])
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

  it("detects data platforms from first-party console and content signals", () => {
    const databricks = customFingerprints.apps.Databricks
    const snowflake = customFingerprints.apps.Snowflake
    const sanity = customFingerprints.apps.Sanity
    const payloadCms = customFingerprints.apps["Payload CMS"]

    expect(databricks.cats).toEqual([34, 47, 62])
    expect(databricks.headers).toEqual({
      server: "^databricks$",
      "x-databricks-org-id": "^\\d+$",
    })
    expect(databricks.dom).toHaveProperty("script#__databricks_react_script")
    expect(databricks.dom).toHaveProperty("script#databricks-safe-flags[type=\"application/json\"]")
    expect(databricks.js).toEqual({
      __DATABRICKS_CONFIG__: "",
      __DATABRICKS_SAFE_FLAGS__: "",
      __databricks_isSpogDomain: "",
    })
    expect(databricks.scriptSrc).toEqual(
      expect.arrayContaining([
        expect.stringContaining("ui-assets\\.(?:cloud|gcp)\\.databricks\\.com"),
        expect.stringContaining("ui-assets\\.azuredatabricks\\.net"),
      ]),
    )

    expect(snowflake.cats).toEqual([34, 47, 62])
    expect(snowflake.cookies).toEqual({
      snowflake_deployment: "",
      snowflakeContext: "",
    })
    expect(snowflake.html).toEqual(
      expect.arrayContaining([
        "\\bSNOWSIGHT_PEP_VERSION_CACHE\\b",
        "\\/pep\\.launch\\.v1\\.LaunchService\\/GetLaunchData\\b",
      ]),
    )

    expect(sanity.cats).toEqual([1])
    expect(sanity.headers).toEqual({
      "content-security-policy": "cdn\\.sanity\\.io",
      "x-sanity-shard": "",
    })
    expect(sanity.html).toEqual(
      expect.arrayContaining([
        expect.stringContaining("cdn\\.sanity\\.io\\/(?:images|files)"),
        expect.stringContaining("(?:api|apicdn)\\.sanity\\.io"),
      ]),
    )
    expect(sanity.css).toEqual([expect.stringContaining("cdn\\.sanity\\.io\\/(?:images|files)")])

    expect(payloadCms.cats).toEqual([1])
    expect(payloadCms.scriptSrc).toEqual([
      expect.stringContaining("\\/npm\\/@payloadcms\\/(?:next|ui|live-preview"),
    ])
    expect(payloadCms.scripts).toEqual(expect.arrayContaining(["\\bpayload-theme\\b"]))
  })

  it("detects Node.js only from explicit self-identifying headers", () => {
    const nodeJs = customFingerprints.apps["Node.js"]

    expect(nodeJs.cats).toEqual([27])
    expect(nodeJs.headers).toEqual({
      "x-powered-by": "^(?:node\\.js|nodejs)$",
      server: "^nodejs$",
    })
    expect(nodeJs).not.toHaveProperty("html")
    expect(nodeJs).not.toHaveProperty("scripts")
    expect(nodeJs.implies).toEqual([])
  })

  it("detects Redux family libraries and Zustand from exact package signals", () => {
    const redux = customFingerprints.apps.Redux
    const reactRedux = customFingerprints.apps["React Redux"]
    const reduxToolkit = customFingerprints.apps["Redux Toolkit"]
    const zustand = customFingerprints.apps.Zustand

    expect(redux.cats).toEqual([12])
    expect(redux.scriptSrc).toEqual(expect.arrayContaining([expect.stringContaining("\\/npm\\/redux@")]))
    expect(reactRedux.cats).toEqual([12])
    expect(reactRedux.scriptSrc).toEqual(expect.arrayContaining([expect.stringContaining("\\/npm\\/react-redux@")]))
    expect(reactRedux.scripts).toEqual(['Symbol\\.for\\(["\']react-redux-context["\']\\)'])
    expect(reactRedux.implies).toEqual(["React", "Redux"])

    expect(reduxToolkit.cats).toEqual([12])
    expect(reduxToolkit.scriptSrc).toEqual([expect.stringContaining("\\/npm\\/@reduxjs\\/toolkit@")])
    expect(reduxToolkit.implies).toEqual(["Redux"])

    expect(zustand.cats).toEqual([59])
    expect(zustand.scriptSrc).toEqual([expect.stringContaining("\\/zustand@")])
    expect(zustand.scripts).toEqual(
      expect.arrayContaining([
        expect.stringContaining("from\\s+"),
        "\\[zustand (?:persist|devtools) middleware\\]",
      ]),
    )
    expect(zustand.implies).toEqual([])
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
