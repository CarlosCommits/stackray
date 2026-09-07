// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  buildBrowserResponsePromotion,
  extractBrowserResponseEvidence,
} from "./browser-response-evidence.ts";

describe("browser response evidence", () => {
  it("does not mistake regular HTTPX fields for browser-native evidence", () => {
    const evidence = extractBrowserResponseEvidence({
      url: "https://example.test/",
      status_code: 200,
      title: "Regular HTTPX title",
      header: { server: "regular-httpx" },
      hash: { body_sha256: "regular-httpx-body" },
    });

    expect(evidence.statusCode).toBeNull();
    expect(evidence.responseHeadersJson).toEqual({});
    expect(evidence.hashesJson).toEqual({});
  });

  it("replaces blocked HTTP response fields with a recovered browser document", () => {
    const evidence = extractBrowserResponseEvidence({
      status_code: 403,
      title: "Checking your browser...",
      browser_response: {
        final_url: "https://wordpress.com/",
        status_code: 200,
        title: "WordPress.com: Everything You Need to Build Your Website",
        webserver: "nginx",
        content_type: "text/html",
        content_length: 368_286,
        words: 25_225,
        lines: 3_703,
        header: {
          server: "nginx",
          vary: "Accept-Encoding, Cookie",
        },
        hash: {
          body_sha256: "recovered-body",
          body_simhash: "9899964551385036782",
        },
        chain_status_codes: [301, 200],
        chain: [
          { "request-url": "https://wordpress.com", status_code: 301 },
          { "request-url": "https://wordpress.com/", status_code: 200 },
        ],
      },
    });

    const promotion = buildBrowserResponsePromotion({
      statusCode: 403,
      title: "Checking your browser...",
      contentType: "text/html",
    }, evidence);

    expect(promotion).toMatchObject({
      finalUrl: "https://wordpress.com/",
      statusCode: 200,
      title: "WordPress.com: Everything You Need to Build Your Website",
      webServer: "nginx",
      contentType: "text/html",
      contentLength: 368_286,
      responseHeadersJson: {
        server: "nginx",
        vary: "Accept-Encoding, Cookie",
      },
      hashesJson: {
        body_sha256: "recovered-body",
        body_simhash: "9899964551385036782",
      },
      redirectChainStatusCodes: [301, 200],
    });
    expect(promotion).not.toHaveProperty("tlsJson");
    expect(promotion).not.toHaveProperty("jarmHash");
  });

  it("retains an observed HTTPX redirect chain when promoting a recovered browser response", () => {
    const evidence = extractBrowserResponseEvidence({
      browser_response: {
        final_url: "https://www.facebook.com/",
        status_code: 200,
        title: "Facebook",
        chain_status_codes: [200],
        chain: [
          { "request-url": "https://www.facebook.com/", status_code: 200 },
        ],
      },
    });
    const httpxChain = [
      { "request-url": "https://facebook.com/", status_code: 301 },
      { "request-url": "https://www.facebook.com/", status_code: 400 },
    ];

    expect(buildBrowserResponsePromotion({
      statusCode: 400,
      title: "Error",
      contentType: "text/html",
      redirectChainStatusCodes: [301, 400],
      redirectChainJson: httpxChain,
    }, evidence)).toMatchObject({
      finalUrl: "https://www.facebook.com/",
      statusCode: 200,
      redirectChainStatusCodes: [301, 400],
      redirectChainJson: httpxChain,
    });
  });

  it("uses a compact browser chain when HTTPX did not observe redirects", () => {
    const repeatedFinalUrl = { "request-url": "https://stackoverflow.com/questions", status_code: 200 };
    const evidence = extractBrowserResponseEvidence({
      browser_response: {
        final_url: "https://stackoverflow.com/questions",
        status_code: 200,
        title: "Newest Questions - Stack Overflow",
        chain_status_codes: [200, 200, 200],
        chain: [repeatedFinalUrl, repeatedFinalUrl, repeatedFinalUrl],
      },
    });

    expect(buildBrowserResponsePromotion({
      statusCode: 403,
      title: "Just a moment...",
      contentType: "text/html",
      redirectChainStatusCodes: [],
      redirectChainJson: [],
    }, evidence)).toMatchObject({
      redirectChainStatusCodes: [200],
      redirectChainJson: [repeatedFinalUrl],
    });
  });

  it("does not replace a usable HTTPX response", () => {
    const evidence = extractBrowserResponseEvidence({
      browser_response: {
        url: "https://example.test/",
        status_code: 200,
        title: "Different browser title",
        header: { server: "browser" },
        hash: { body_sha256: "browser-body" },
      },
    });

    expect(buildBrowserResponsePromotion({
      statusCode: 200,
      title: "Authoritative HTTPX title",
      contentType: "text/html",
    }, evidence)).toEqual({});
  });

  it("does not promote another blocked browser response", () => {
    const evidence = extractBrowserResponseEvidence({
      browser_response: {
        url: "https://example.test/",
        status_code: 403,
        title: "Checking your browser...",
        header: { server: "challenge" },
      },
    });

    expect(buildBrowserResponsePromotion({
      statusCode: 403,
      title: "Checking your browser...",
      contentType: "text/html",
    }, evidence)).toEqual({});
  });
});
