// @vitest-environment node

import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import { PassThrough } from "node:stream";

import { afterEach, describe, expect, it, vi } from "vitest";
import { parse as parseYaml } from "yaml";

import {
  NUCLEI_DOMAIN_TEMPLATE_IDS,
  NUCLEI_RDAP_TEMPLATE_IDS,
  NUCLEI_TEMPLATE_ALLOWLIST,
  NUCLEI_TXT_SERVICE_TEMPLATE_IDS,
  NUCLEI_URL_TEMPLATE_IDS,
  buildNucleiArguments,
  parseNucleiJsonLine,
  runNucleiCli,
  withNucleiMatchExecutionContext,
} from "@/worker/nuclei";

class FakeNucleiProcess extends EventEmitter {
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly killSignals: Array<NodeJS.Signals | number | undefined> = [];
  killed = false;

  kill(signal?: NodeJS.Signals | number) {
    this.killed = true;
    this.killSignals.push(signal);
    setImmediate(() => this.close(null));
    return true;
  }

  close(code: number | null = 0) {
    this.stdout.end();
    this.stderr.end();
    this.emit("close", code);
  }
}

afterEach(() => {
  vi.useRealTimers();
});

function normalizeArgumentPaths(args: readonly string[]) {
  return args.map((value) => value.replace(/\\/g, "/"));
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value));
  }

  throw new Error(`${label} must be an object`);
}

function asArray(value: unknown, label: string): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  throw new Error(`${label} must be an array`);
}

const repoLocalTemplateCases = [
  {
    id: "replit-dns-verification",
    pathSuffix: "/worker/nuclei-templates/dns/replit-dns-verification.yaml",
  },
  {
    id: "stackray-dns-service-detection",
    pathSuffix: "/worker/nuclei-templates/dns/stackray-dns-service-detection.yaml",
  },
] as const;

describe("repo-local nuclei templates", () => {
  it("keeps the Stackray DNS service template registration aligned with the actual YAML", async () => {
    const templateContents = await readFile(
      new URL("./nuclei-templates/dns/stackray-dns-service-detection.yaml", import.meta.url),
      "utf8",
    );
    const template = asRecord(parseYaml(templateContents), "stackray DNS service template");
    const dnsEntries = asArray(template.dns, "template dns entries").map((entry, index) => asRecord(entry, `dns entry ${index}`));
    const txtEntry = dnsEntries.find((entry) => entry.type === "TXT" && entry.name === "{{FQDN}}");
    const resendTxtEntry = dnsEntries.find((entry) => entry.type === "TXT" && entry.name === "resend._domainkey.{{FQDN}}");
    const mxEntry = dnsEntries.find((entry) => entry.type === "MX");
    const nsEntry = dnsEntries.find((entry) => entry.type === "NS");
    const cnameEntry = dnsEntries.find((entry) => entry.type === "CNAME");

    if (!txtEntry || !resendTxtEntry || !mxEntry || !nsEntry || !cnameEntry) {
      throw new Error("stackray DNS service template must include root TXT, Resend TXT, MX, NS, and CNAME entries");
    }

    const txtMatchers = asArray(txtEntry.matchers, "TXT matchers")
      .map((matcher, index) => asRecord(matcher, `TXT matcher ${index}`));
    const txtMatcherNames = txtMatchers.map((matcher) => matcher.name);
    const pardotMailMatcher = txtMatchers.find((matcher) => matcher.name === "Pardot Mail");
    const salesforceSpfMatcher = txtMatchers.find((matcher) => matcher.name === "Salesforce SPF");
    const mailgunTxtMatcher = txtMatchers.find((matcher) => matcher.name === "Mailgun");
    const sendGridTxtMatcher = txtMatchers.find((matcher) => matcher.name === "SendGrid");
    const postmarkTxtMatcher = txtMatchers.find((matcher) => matcher.name === "Postmark");
    const mailchimpMatcher = txtMatchers.find((matcher) => matcher.name === "MailChimp");
    const campaignMonitorMatcher = txtMatchers.find((matcher) => matcher.name === "Campaign Monitor");
    const proofpointMatcher = txtMatchers.find((matcher) => matcher.name === "Proofpoint");
    const cursorMatcher = txtMatchers.find((matcher) => matcher.name === "Cursor");
    const salesforceMarketingCloudMatcher = txtMatchers.find((matcher) => matcher.name === "Salesforce Marketing Cloud");
    const signInSolutionsMatcher = txtMatchers.find((matcher) => matcher.name === "Sign In Solutions");
    const elevenLabsMatcher = txtMatchers.find((matcher) => matcher.name === "ElevenLabs");
    const sageIntacctMatcher = txtMatchers.find((matcher) => matcher.name === "Sage Intacct");
    const gitKrakenMatcher = txtMatchers.find((matcher) => matcher.name === "GitKraken");
    const metaTxtMatchers = [
      ["Intercom", "intercom-domain-validation=[A-Za-z0-9-]{16,}", "intercom-domain-validation=dc8938df-ba79-4019-8809-1b836c9117c4"],
      ["Bitrise", "bitrise-verification=[A-Za-z0-9_-]+-[A-Za-z0-9_-]+", "bitrise-verification=abf0a61c07a7d976-rH78UI9wM4ed"],
      ["Razorpay", "rzp-site-verification=[a-f0-9]{32}", "rzp-site-verification=224114166287f72512718dbdf148433b"],
      ["Mentimeter", "mentimeter-[0-9a-f-]{36}", "mentimeter-16bdc82d-93be-47de-a6d4-fd6adb17c403"],
      ["Bluebeam", "bluebeam-verification=[A-Za-z0-9_-]+", "bluebeam-verification=ndxhnuqs84dkpsrlyj8v8hwikmaudw"],
      ["Censys", "censys-domain-verification=[A-Za-z0-9_-]+", "censys-domain-verification=Yo-juPBT_qmJ-qe2cmh9ytUXJhAPx0fy3l8UfLW6iFkG"],
      ["Krisp", "krisp-domain-verification=[A-Za-z0-9_-]+", "krisp-domain-verification=Qo1RXvowjIIJwtkuCGLXn9rb42ouFiD1"],
      ["Manus", "manus-domain-verification-[a-z0-9_-]+=[A-Za-z0-9_-]+", "manus-domain-verification-ccwyr4=xqSOkWFnTHeCFASkoQ5YW3VhF"],
      ["Meshy", "meshy-verification=[a-f0-9]{32}", "meshy-verification=019ba48cb37a7d60ae664246433708b0"],
      ["Dust", "dust-domain-verification-[a-z0-9_-]+=[A-Za-z0-9_-]+", "dust-domain-verification-98xyt7=10CFebRuinJsIZ3GBaR3odOk"],
      ["Gamma", "gamma-domain-verification-[a-z0-9_-]+=[A-Za-z0-9_-]+", "gamma-domain-verification-zgq5h4=OgSeTkAEhYH7u8jgIcEws1F3b"],
      ["Reachdesk", "reachdesk-verification=[A-Za-z0-9_-]+", "reachdesk-verification=wqiR69iCPMKXrUXbvACpeThZhtqtWyaDa0DY8uwfNYhqbUTeP7gKb3c9qCv4MM8m"],
      ["Attio", "attio-domain-verification=[A-Za-z0-9_-]+", "attio-domain-verification=WBPJVBN7VECQX6VDDVB4CH72"],
      ["Hex", "hextech-site-verification=[a-f0-9]{32}", "hextech-site-verification=638379e0e33cd3ab3bb220fc424f886e"],
      ["TikTok", "tiktok-domain-verification=[A-Fa-f0-9]{32,}", "tiktok-domain-verification=e8242b26316716e951678da03b794de5a838482929d5b62ea2e0a3b4baf843f3"],
      ["DeepL", "deepl-domain-verification=[A-Fa-f0-9]{32,}", "deepl-domain-verification=f6610dd4c1414006bd6382c115542467"],
      ["Freepik", "freepik-domain-verification=[A-Fa-f0-9]{32,}", "freepik-domain-verification=eeb4ee5ff6237e57ea15d2369b574c68"],
      ["Appspace", "appspace-domain-verification=[A-Fa-f0-9]{32,}", "appspace-domain-verification=59cd40985507690b0ac0e2c83d24dd6dfa24c7d7571f00b7401e01d5c12332af"],
      ["Luma AI", "luma-ai-domain-verification-[a-z0-9_-]+=[A-Za-z0-9_-]+", "luma-ai-domain-verification-340eet=BLdaj62h2qtpk2yvLLYFNuMA9"],
      ["Unity", "unity-sso-verification=[a-f0-9-]{32,36}", "unity-sso-verification=46eb4cbd-e316-4691-84c2-4f4bce784d84"],
      ["Gradle", "gradle-verification=[A-Za-z0-9_-]+", "gradle-verification=9f3b2a7c4d"],
      ["Rippling", "rippling-domain-verification=[A-Za-z0-9_-]+", "rippling-domain-verification=rp_9f3b2a7c4d"],
      ["HeyGen", "heygen-verification=[A-Za-z0-9_-]+", "heygen-verification=hg_9f3b2a7c4d"],
      ["LaunchDarkly", "launchdarkly-domain-verification=[A-Za-z0-9_-]+", "launchdarkly-domain-verification=ld_9f3b2a7c4d"],
      ["ProjectDiscovery", "projectdiscovery-verification=[A-Za-z0-9_-]+", "projectdiscovery-verification=pd_9f3b2a7c4d"],
    ] as const;
    const resendTxtMatchers = asArray(resendTxtEntry.matchers, "Resend TXT matchers")
      .map((matcher, index) => asRecord(matcher, `Resend TXT matcher ${index}`));
    const resendMatcher = resendTxtMatchers.find((matcher) => matcher.name === "Resend");
    const mxMatchers = asArray(mxEntry.matchers, "MX matchers")
      .map((matcher, index) => asRecord(matcher, `MX matcher ${index}`));
    const mxMatcherNames = mxMatchers.map((matcher) => matcher.name);
    const mailgunMxMatcher = mxMatchers.find((matcher) => matcher.name === "Mailgun");
    const nsMatcherNames = asArray(nsEntry.matchers, "NS matchers")
      .map((matcher, index) => asRecord(matcher, `NS matcher ${index}`).name);
    const cnameMatchers = asArray(cnameEntry.matchers, "CNAME matchers")
      .map((matcher, index) => asRecord(matcher, `CNAME matcher ${index}`));
    const cnameMatcherNames = cnameMatchers.map((matcher) => matcher.name);
    const convexMatcher = cnameMatchers.find((matcher) => matcher.name === "Convex");
    const snowflakeMatcher = cnameMatchers.find((matcher) => matcher.name === "Snowflake");

    if (!pardotMailMatcher || !salesforceSpfMatcher || !mailgunTxtMatcher || !sendGridTxtMatcher || !postmarkTxtMatcher || !mailchimpMatcher || !campaignMonitorMatcher || !proofpointMatcher || !cursorMatcher || !salesforceMarketingCloudMatcher || !signInSolutionsMatcher || !elevenLabsMatcher || !sageIntacctMatcher || !gitKrakenMatcher || !resendMatcher) {
      throw new Error("stackray DNS service template must include the Pardot Mail, Salesforce SPF, Mailgun, SendGrid, Postmark, MailChimp, Campaign Monitor, Proofpoint, Cursor, Salesforce Marketing Cloud, Sign In Solutions, ElevenLabs, Sage Intacct, GitKraken, and Resend matchers");
    }
    for (const [matcherName] of metaTxtMatchers) {
      if (!txtMatchers.some((matcher) => matcher.name === matcherName)) {
        throw new Error(`stackray DNS service template must include the ${matcherName} matcher`);
      }
    }

    expect(template.id).toBe("stackray-dns-service-detection");
    expect(NUCLEI_TEMPLATE_ALLOWLIST).toContain(template.id);
    expect(NUCLEI_DOMAIN_TEMPLATE_IDS).toContain(template.id);
    expect(txtMatcherNames).toEqual(expect.arrayContaining(["Amazon SES", "Pardot Mail", "Salesforce SPF", "Mailgun", "SendGrid", "Postmark", "MailChimp", "Campaign Monitor", "Proofpoint", "Zoom", "Cursor", "Salesforce Marketing Cloud", "Sign In Solutions", "ElevenLabs", "Sage Intacct", "GitKraken", ...metaTxtMatchers.map(([matcherName]) => matcherName)]));
    expect(pardotMailMatcher).toEqual(expect.objectContaining({
      type: "regex",
      part: "answer",
    }));
    expect(asArray(pardotMailMatcher.regex, "Pardot Mail matcher regex")).toEqual([
      "(?i)\\bpardot\\d+=",
      "(?i)\\bsending_domain\\d+=",
      "(?i)\\binclude:aspmx\\.pardot\\.com\\b",
    ]);
    expect(salesforceSpfMatcher).toEqual(expect.objectContaining({
      type: "regex",
      part: "answer",
    }));
    expect(asArray(salesforceSpfMatcher.regex, "Salesforce SPF matcher regex")).toEqual([
      "(?i)\\binclude:_spf\\.salesforce\\.com\\b",
    ]);
    const [salesforceSpfPattern] = asArray(salesforceSpfMatcher.regex, "Salesforce SPF matcher regex");

    if (typeof salesforceSpfPattern !== "string") {
      throw new Error("Salesforce SPF matcher regex must contain a string pattern");
    }

    const salesforceSpfRegex = new RegExp(salesforceSpfPattern.replace("(?i)", ""), "iu");

    expect(salesforceSpfRegex.test("v=spf1 include:_spf.salesforce.com -all")).toBe(true);
    expect(salesforceSpfRegex.test("v=spf1 include:aspmx.pardot.com -all")).toBe(false);
    expect(salesforceSpfRegex.test("v=spf1 include:_spf.example.com -all")).toBe(false);
    expect(mailgunTxtMatcher).toEqual(expect.objectContaining({
      type: "regex",
      part: "answer",
    }));
    expect(asArray(mailgunTxtMatcher.regex, "Mailgun matcher regex")).toEqual([
      "(?i)\\binclude:mailgun\\.org\\b",
      "(?i)\\bmgverify=[a-f0-9]{64}\\b",
    ]);
    expect(sendGridTxtMatcher).toEqual(expect.objectContaining({
      type: "regex",
      part: "answer",
    }));
    expect(asArray(sendGridTxtMatcher.regex, "SendGrid matcher regex")).toEqual([
      "(?i)\\binclude:sendgrid\\.net\\b",
    ]);
    expect(postmarkTxtMatcher).toEqual(expect.objectContaining({
      type: "regex",
      part: "answer",
    }));
    expect(asArray(postmarkTxtMatcher.regex, "Postmark matcher regex")).toEqual([
      "(?i)\\binclude:spf\\.mtasv\\.net\\b",
    ]);
    expect(mailchimpMatcher).toEqual(expect.objectContaining({
      type: "regex",
      part: "answer",
    }));
    expect(asArray(mailchimpMatcher.regex, "MailChimp matcher regex")).toEqual([
      "(?i)\\binclude:servers\\.mcsv\\.net\\b",
    ]);
    expect(campaignMonitorMatcher).toEqual(expect.objectContaining({
      type: "regex",
      part: "answer",
    }));
    expect(asArray(campaignMonitorMatcher.regex, "Campaign Monitor matcher regex")).toEqual([
      "(?i)\\binclude:_spf\\.createsend\\.com\\b",
    ]);

    const emailServiceRegexes = [
      [sendGridTxtMatcher, "SendGrid", "v=spf1 include:sendgrid.net -all", "include:sendgrid.example.net"],
      [postmarkTxtMatcher, "Postmark", "v=spf1 include:spf.mtasv.net -all", "include:spf.example.net"],
      [mailchimpMatcher, "MailChimp", "v=spf1 include:servers.mcsv.net -all", "include:servers.example.net"],
      [campaignMonitorMatcher, "Campaign Monitor", "v=spf1 include:_spf.createsend.com -all", "include:_spf.example.com"],
    ] as const;

    for (const [matcher, label, validExample, invalidExample] of emailServiceRegexes) {
      const [pattern] = asArray(matcher.regex, `${label} matcher regex`);

      if (typeof pattern !== "string") {
        throw new Error(`${label} matcher regex must contain a string pattern`);
      }

      const regex = new RegExp(pattern.replace("(?i)", ""), "iu");

      expect(regex.test(validExample)).toBe(true);
      expect(regex.test(invalidExample)).toBe(false);
    }
    expect(proofpointMatcher).toEqual(expect.objectContaining({
      type: "regex",
      part: "answer",
    }));
    const [proofpointPattern] = asArray(proofpointMatcher.regex, "Proofpoint matcher regex");

    if (typeof proofpointPattern !== "string") {
      throw new Error("Proofpoint matcher regex must contain a string pattern");
    }

    const proofpointRegex = new RegExp(proofpointPattern.replace("(?i)", ""), "iu");

    expect(proofpointRegex.test("v=spf1 include:%{ir}.%{v}.%{d}.spf.has.pphosted.com ~all")).toBe(true);
    expect(proofpointRegex.test("v=spf1 include:aspmx.pardot.com ~all")).toBe(false);
    expect(cursorMatcher).toEqual(expect.objectContaining({
      type: "regex",
      part: "answer",
    }));
    expect(cursorMatcher).not.toHaveProperty("words");
    expect(asArray(cursorMatcher.regex, "Cursor matcher regex")).toEqual([
      "cursor-domain-verification-[a-z0-9_-]+=[A-Za-z0-9_-]+",
    ]);
    const [cursorPattern] = asArray(cursorMatcher.regex, "Cursor matcher regex");

    if (typeof cursorPattern !== "string") {
      throw new Error("Cursor matcher regex must contain a string pattern");
    }

    const cursorRegex = new RegExp(cursorPattern, "u");

    expect(cursorRegex.test("cursor-domain-verification-nmwzhe=8wrKyUOwEPSBwFK54McJp6vdx")).toBe(true);
    expect(cursorRegex.test("cursor-domain-verification-")).toBe(false);
    expect(cursorRegex.test("cursor-domain-verification-example")).toBe(false);
    expect(cursorRegex.test("cursor-domain-verification-=missingSuffix")).toBe(false);
    expect(cursorRegex.test("cursor-domain-verification-example=")).toBe(false);
    expect(salesforceMarketingCloudMatcher).toEqual(expect.objectContaining({
      type: "regex",
      part: "answer",
    }));
    expect(asArray(salesforceMarketingCloudMatcher.regex, "Salesforce Marketing Cloud matcher regex")).toEqual([
      "SFMC-[A-Za-z0-9_-]+",
    ]);
    const [salesforceMarketingCloudPattern] = asArray(salesforceMarketingCloudMatcher.regex, "Salesforce Marketing Cloud matcher regex");

    if (typeof salesforceMarketingCloudPattern !== "string") {
      throw new Error("Salesforce Marketing Cloud matcher regex must contain a string pattern");
    }

    const salesforceMarketingCloudRegex = new RegExp(salesforceMarketingCloudPattern, "u");

    expect(salesforceMarketingCloudRegex.test("SFMC-qkAv7SvlQaslp7NEALX8t68s_AZWOQB6ThKQS5l5")).toBe(true);
    expect(salesforceMarketingCloudRegex.test("SFMC-")).toBe(false);
    expect(salesforceMarketingCloudRegex.test("sfmc-qkAv7SvlQaslp7NEALX8t68s_AZWOQB6ThKQS5l5")).toBe(false);
    expect(signInSolutionsMatcher).toEqual(expect.objectContaining({
      type: "regex",
      part: "answer",
    }));
    expect(asArray(signInSolutionsMatcher.regex, "Sign In Solutions matcher regex")).toEqual([
      "traction-guest=[a-f0-9-]{32,36}",
    ]);
    const [signInSolutionsPattern] = asArray(signInSolutionsMatcher.regex, "Sign In Solutions matcher regex");

    if (typeof signInSolutionsPattern !== "string") {
      throw new Error("Sign In Solutions matcher regex must contain a string pattern");
    }

    const signInSolutionsRegex = new RegExp(signInSolutionsPattern, "u");

    expect(signInSolutionsRegex.test("traction-guest=b4f7ad59-bf17-4b3c-8b36-9c2d28f1de32")).toBe(true);
    expect(signInSolutionsRegex.test("traction-guest=")).toBe(false);
    expect(signInSolutionsRegex.test("traction-guest=not-a-token")).toBe(false);
    expect(elevenLabsMatcher).toEqual(expect.objectContaining({
      type: "regex",
      part: "answer",
    }));
    expect(asArray(elevenLabsMatcher.regex, "ElevenLabs matcher regex")).toEqual([
      "elevenlabs=[A-Za-z0-9_-]{16,}",
    ]);
    const [elevenLabsPattern] = asArray(elevenLabsMatcher.regex, "ElevenLabs matcher regex");

    if (typeof elevenLabsPattern !== "string") {
      throw new Error("ElevenLabs matcher regex must contain a string pattern");
    }

    const elevenLabsRegex = new RegExp(elevenLabsPattern, "u");

    expect(elevenLabsRegex.test("elevenlabs=7WqXlRwQh8-jH2984SP4TQCS0MWL3IoSp8kynyVKVg8")).toBe(true);
    expect(elevenLabsRegex.test("elevenlabs=")).toBe(false);
    expect(elevenLabsRegex.test("elevenlabs=short")).toBe(false);
    expect(sageIntacctMatcher).toEqual(expect.objectContaining({
      type: "regex",
      part: "answer",
    }));
    expect(asArray(sageIntacctMatcher.regex, "Sage Intacct matcher regex")).toEqual([
      "(?i)\\bintacct-esk=[A-Fa-f0-9]{16,}\\b",
      "(?i)\\binclude:_spf\\.intacct\\.com\\b",
    ]);
    const sageIntacctPatterns = asArray(sageIntacctMatcher.regex, "Sage Intacct matcher regex");
    const sageIntacctRegexes = sageIntacctPatterns.map((pattern) => {
      if (typeof pattern !== "string") {
        throw new Error("Sage Intacct matcher regex must contain string patterns");
      }

      return new RegExp(pattern.replace("(?i)", ""), "iu");
    });

    expect(sageIntacctRegexes.some((regex) => regex.test("intacct-esk=4FED1A4780E0FB23E0539806A8C0D680"))).toBe(true);
    expect(sageIntacctRegexes.some((regex) => regex.test("v=spf1 include:_spf.intacct.com -all"))).toBe(true);
    expect(sageIntacctRegexes.some((regex) => regex.test("intacct-esk="))).toBe(false);
    expect(sageIntacctRegexes.some((regex) => regex.test("include:_spf.example.com"))).toBe(false);
    expect(gitKrakenMatcher).toEqual(expect.objectContaining({
      type: "regex",
      part: "answer",
    }));
    expect(asArray(gitKrakenMatcher.regex, "GitKraken matcher regex")).toEqual([
      "gitkraken-domain-verification=[a-f0-9]{64}",
    ]);
    const [gitKrakenPattern] = asArray(gitKrakenMatcher.regex, "GitKraken matcher regex");

    if (typeof gitKrakenPattern !== "string") {
      throw new Error("GitKraken matcher regex must contain a string pattern");
    }

    const gitKrakenRegex = new RegExp(gitKrakenPattern, "u");

    expect(gitKrakenRegex.test("gitkraken-domain-verification=b48e62e0b5b3d92167c9c4a087364734970a7f8c3cf984b1a62acc8921ea22c3")).toBe(true);
    expect(gitKrakenRegex.test("gitkraken-domain-verification=")).toBe(false);
    expect(gitKrakenRegex.test("gitkraken-domain-verification=not-a-hex-token")).toBe(false);
    for (const [matcherName, expectedPattern, validExample] of metaTxtMatchers) {
      const matcher = txtMatchers.find((candidate) => candidate.name === matcherName);

      expect(matcher).toEqual(expect.objectContaining({
        type: "regex",
        part: "answer",
      }));
      expect(asArray(matcher?.regex, `${matcherName} matcher regex`)).toEqual([expectedPattern]);

      const regex = new RegExp(expectedPattern, "u");

      expect(regex.test(validExample)).toBe(true);
      expect(regex.test(`${matcherName.toLowerCase()}=`)).toBe(false);
    }
    expect(resendMatcher).toEqual(expect.objectContaining({
      type: "regex",
      part: "answer",
    }));
    expect(asArray(resendMatcher.regex, "Resend matcher regex")).toEqual([
      "(?i)\\bp=[A-Za-z0-9+/=]{64,}\\b",
    ]);
    expect(mxMatcherNames).toEqual(["Mailgun"]);

    if (!mailgunMxMatcher) {
      throw new Error("stackray DNS service template must include the Mailgun MX matcher");
    }

    const [mailgunMxPattern] = asArray(mailgunMxMatcher.regex, "Mailgun MX matcher regex");

    if (typeof mailgunMxPattern !== "string") {
      throw new Error("Mailgun MX matcher regex must contain a string pattern");
    }

    const mailgunMxRegex = new RegExp(mailgunMxPattern.replace("(?i)", ""), "iu");

    expect(mailgunMxRegex.test("target.example.com. 300 IN MX 10 mxa.mailgun.org.")).toBe(true);
    expect(mailgunMxRegex.test("target.example.com. 300 IN MX 10 mxb.mailgun.org.")).toBe(true);
    expect(mailgunMxRegex.test("target.example.com. 300 IN MX 10 mx.example.org.")).toBe(false);
    expect(nsMatcherNames).toEqual(["Amazon Route 53", "Microsoft Azure DNS"]);
    expect(cnameMatcherNames).toEqual(["Convex", "Snowflake"]);

    if (!convexMatcher || !snowflakeMatcher) {
      throw new Error("stackray DNS service template must include the Convex and Snowflake matchers");
    }

    const [convexPattern] = asArray(convexMatcher.regex, "Convex matcher regex");

    if (typeof convexPattern !== "string") {
      throw new Error("Convex matcher regex must contain a string pattern");
    }

    const convexRegex = new RegExp(convexPattern.replace("(?i)", ""), "iu");

    expect(convexRegex.test("api.example.com. 300 IN CNAME happy-animal-123.convex.cloud.")).toBe(true);
    expect(convexRegex.test("api.example.com. 300 IN CNAME happy-animal-123.convex.site.")).toBe(true);
    expect(convexRegex.test("api.example.com. 300 IN CNAME happy-animal-123.notconvex.site.")).toBe(false);

    const [snowflakePattern] = asArray(snowflakeMatcher.regex, "Snowflake matcher regex");

    if (typeof snowflakePattern !== "string") {
      throw new Error("Snowflake matcher regex must contain a string pattern");
    }

    const snowflakeRegex = new RegExp(snowflakePattern.replace("(?i)", ""), "iu");

    expect(snowflakeRegex.test("app.example.com. 300 IN CNAME org-account.snowflakecomputing.com.")).toBe(true);
    expect(snowflakeRegex.test("app.example.com. 300 IN CNAME org-account.privatelink.snowflakecomputing.com.")).toBe(true);
    expect(snowflakeRegex.test("app.example.com. 300 IN CNAME app.snowflake.app.")).toBe(true);
    expect(snowflakeRegex.test("app.example.com. 300 IN CNAME app.not-snowflake.app.")).toBe(false);
  });
});

describe("buildNucleiArguments", () => {
  it("bundles the template allowlist without txt-service include tags by default", () => {
    const args = buildNucleiArguments({
      target: "https://example.com/login",
      templateIds: NUCLEI_TEMPLATE_ALLOWLIST,
      headers: ["User-Agent: Test Browser", "Accept: text/html"],
    });

    expect(args[args.indexOf("-u") + 1]).toBe("https://example.com/login");
    expect(args).toContain("-jsonl");
    expect(args).toContain("-silent");
    expect(args).toContain("-nc");
    expect(args).toContain("-or");
    expect(args).toContain("-ot");
    expect(args).toContain("-duc");
    expect(args[args.indexOf("-id") + 1]).toBe(
      NUCLEI_TEMPLATE_ALLOWLIST.filter(
        (templateId) => !["replit-dns-verification", "stackray-dns-service-detection"].includes(templateId),
      ).join(","),
    );
    expect(
      normalizeArgumentPaths(args).some((value) => value.endsWith("/worker/nuclei-templates/dns/replit-dns-verification.yaml")),
    ).toBe(true);
    expect(
      normalizeArgumentPaths(args).some((value) => value.endsWith("/worker/nuclei-templates/dns/stackray-dns-service-detection.yaml")),
    ).toBe(true);
    expect(args).not.toContain("-itags");
    expect(args.filter((value) => value === "-H")).toHaveLength(2);
  });

  it("uses explicit template paths when a templates directory is configured", () => {
    const args = buildNucleiArguments({
      target: "https://example.com/login",
      templateIds: NUCLEI_TEMPLATE_ALLOWLIST,
      headers: [],
      templatesDir: "/opt/nuclei-templates",
    });

    expect(args).not.toContain("-id");
    expect(args.filter((value) => value === "-t")).toHaveLength(NUCLEI_TEMPLATE_ALLOWLIST.length);
    expect(args).toContain("/opt/nuclei-templates/ssl/detect-ssl-issuer.yaml");
    expect(args).toContain("/opt/nuclei-templates/dns/txt-fingerprint.yaml");
    expect(args).not.toContain("/opt/nuclei-templates/dns/nameserver-fingerprint.yaml");
    expect(args).toContain("/opt/nuclei-templates/http/miscellaneous/rdap-whois.yaml");
    expect(args).not.toContain("/opt/nuclei-templates/dns/replit-dns-verification.yaml");
    expect(
      normalizeArgumentPaths(args).some((value) => value.endsWith("/worker/nuclei-templates/dns/replit-dns-verification.yaml")),
    ).toBe(true);
    expect(
      normalizeArgumentPaths(args).some((value) => value.endsWith("/worker/nuclei-templates/dns/stackray-dns-service-detection.yaml")),
    ).toBe(true);
    expect(args).toContain("/opt/nuclei-templates/http/miscellaneous/robots-txt.yaml");
  });

  it("supports running a domain-only subset against a non-url target", () => {
    const args = buildNucleiArguments({
      target: "example.com",
      templateIds: NUCLEI_DOMAIN_TEMPLATE_IDS,
      headers: [],
    });

    expect(args[args.indexOf("-u") + 1]).toBe("example.com");
    expect(args[args.indexOf("-id") + 1]).toBe(
      NUCLEI_DOMAIN_TEMPLATE_IDS.filter(
        (templateId) => !["replit-dns-verification", "stackray-dns-service-detection"].includes(templateId),
      ).join(","),
    );
    expect(
      normalizeArgumentPaths(args).some((value) => value.endsWith("/worker/nuclei-templates/dns/replit-dns-verification.yaml")),
    ).toBe(true);
    expect(
      normalizeArgumentPaths(args).some((value) => value.endsWith("/worker/nuclei-templates/dns/stackray-dns-service-detection.yaml")),
    ).toBe(true);
    expect(args).not.toContain("-itags");
    expect(args).toContain("-dr");
  });

  it("supports running a url-only subset against the final web target", () => {
    const args = buildNucleiArguments({
      target: "https://example.com/login",
      templateIds: NUCLEI_URL_TEMPLATE_IDS,
      headers: [],
    });

    expect(args[args.indexOf("-id") + 1]).toBe(NUCLEI_URL_TEMPLATE_IDS.join(","));
    expect(args).not.toContain("-itags");
  });

  it("supports running txt-service-detect in an isolated invocation with include tags", () => {
    const args = buildNucleiArguments({
      target: "example.com",
      templateIds: NUCLEI_TXT_SERVICE_TEMPLATE_IDS,
      includeTags: ["txt-service"],
      headers: [],
    });

    expect(args[args.indexOf("-id") + 1]).toBe(NUCLEI_TXT_SERVICE_TEMPLATE_IDS.join(","));
    expect(args[args.indexOf("-itags") + 1]).toBe("txt-service");
    expect(args).toContain("-dr");
  });

  it.each(repoLocalTemplateCases)("resolves repo-local template $id to a repo-local path when no templates directory is configured", ({ id, pathSuffix }) => {
    const args = buildNucleiArguments({
      target: "example.com",
      templateIds: [id],
      headers: [],
    });

    expect(args).not.toContain("-id");
    expect(args).toContain("-t");
    expect(
      normalizeArgumentPaths(args).some((value) => value.endsWith(pathSuffix)),
    ).toBe(true);
    expect(args).toContain("-dr");
  });

  it.each(repoLocalTemplateCases)("keeps repo-local template $id on its repo-local path even when templates directory is configured", ({ id, pathSuffix }) => {
    const args = buildNucleiArguments({
      target: "example.com",
      templateIds: [id],
      disableRedirects: false,
      headers: [],
      templatesDir: "/opt/nuclei-templates",
    });

    expect(args).not.toContain("-id");
    expect(args).toContain("-t");
    expect(args).not.toContain(`/opt/nuclei-templates/${pathSuffix.split("/worker/nuclei-templates/")[1]}`);
    expect(
      normalizeArgumentPaths(args).some((value) => value.endsWith(pathSuffix)),
    ).toBe(true);
  });

  it("allows redirect-following for the isolated RDAP phase", () => {
    const args = buildNucleiArguments({
      target: "example.com",
      templateIds: NUCLEI_RDAP_TEMPLATE_IDS,
      disableRedirects: false,
      headers: [],
    });

    expect(args).not.toContain("-dr");
    expect(args[args.indexOf("-id") + 1]).toBe("rdap-whois");
    expect(args).not.toContain("-t");
  });
});

describe("parseNucleiJsonLine", () => {
  it("maps technology templates into technology findings without inventing versions", () => {
    const match = parseNucleiJsonLine({
      "template-id": "tech-detect",
      "template-path": "http/technologies/tech-detect.yaml",
      "matcher-name": "Next.js",
      type: "http",
      severity: "info",
      "matched-at": "https://example.com/",
      host: "https://example.com",
      ip: "203.0.113.10",
      url: "https://example.com",
      scheme: "https",
      port: 443,
      path: "/",
      "extracted-results": ["nextjs"],
    });

    expect(match).toEqual({
      templateId: "tech-detect",
      templatePath: "http/technologies/tech-detect.yaml",
      matcherName: "Next.js",
      protocolType: "http",
      severity: "info",
      matchedAt: "https://example.com/",
      host: "https://example.com",
      ip: "203.0.113.10",
      port: "443",
      scheme: "https",
      url: "https://example.com",
      path: "/",
      extractedResults: ["nextjs"],
      technologyName: "Next.js",
      technologyVersion: null,
      findingKind: "technology",
      subject: null,
      subjectType: "url",
      rawJson: {
        "template-id": "tech-detect",
        "template-path": "http/technologies/tech-detect.yaml",
        "matcher-name": "Next.js",
        type: "http",
        severity: "info",
        "matched-at": "https://example.com/",
        host: "https://example.com",
        ip: "203.0.113.10",
        url: "https://example.com",
        scheme: "https",
        port: 443,
        path: "/",
        "extracted-results": ["nextjs"],
      },
    });

    const payloadCmsMatch = parseNucleiJsonLine({
      "template-id": "payloadcms-detect",
      "template-path": "http/technologies/payloadcms-detect.yaml",
      type: "http",
      severity: "info",
      "matched-at": "https://example.com/admin/login",
      host: "https://example.com",
      url: "https://example.com/admin/login",
      scheme: "https",
      port: 443,
      path: "/admin/login",
    });

    expect(payloadCmsMatch).toEqual(expect.objectContaining({
      templateId: "payloadcms-detect",
      templatePath: "http/technologies/payloadcms-detect.yaml",
      matcherName: null,
      technologyName: "Payload CMS",
      technologyVersion: null,
      findingKind: "technology",
      subjectType: "url",
    }));

    const odooMatch = parseNucleiJsonLine({
      "template-id": "odoo-detection",
      "template-path": "http/technologies/odoo-detect.yaml",
      type: "http",
      severity: "info",
      "matched-at": "https://erp.example.com/web/webclient/version_info",
      host: "https://erp.example.com",
      url: "https://erp.example.com/web/webclient/version_info",
      scheme: "https",
      port: 443,
      path: "/web/webclient/version_info",
      "extracted-results": ["18.0+e"],
    });

    expect(odooMatch).toEqual(expect.objectContaining({
      templateId: "odoo-detection",
      templatePath: "http/technologies/odoo-detect.yaml",
      matcherName: null,
      extractedResults: ["18.0+e"],
      technologyName: "Odoo",
      technologyVersion: "18.0+e",
      findingKind: "technology",
      subjectType: "url",
    }));
  });

  it("keeps non-technology templates as namespaced findings", () => {
    const match = parseNucleiJsonLine({
      "template-id": "ssl-issuer",
      template: "ssl/detect-ssl-issuer.yaml",
      "matcher-name": "Let's Encrypt",
      type: "ssl",
      severity: "info",
      "matched-at": "example.com:443",
      host: "example.com",
      ip: "203.0.113.10",
      url: "https://example.com",
      scheme: "https",
      port: "443",
      path: "/",
      "extracted-results": ["C=US, O=Let's Encrypt, CN=R3"],
    });

    expect(match).toEqual({
      templateId: "ssl-issuer",
      templatePath: "ssl/detect-ssl-issuer.yaml",
      matcherName: "Let's Encrypt",
      protocolType: "ssl",
      severity: "info",
      matchedAt: "example.com:443",
      host: "example.com",
      ip: "203.0.113.10",
      port: "443",
      scheme: "https",
      url: "https://example.com",
      path: "/",
      extractedResults: ["C=US, O=Let's Encrypt, CN=R3"],
      technologyName: null,
      technologyVersion: null,
      findingKind: "ssl_issuer",
      subject: null,
      subjectType: "url",
      rawJson: {
        "template-id": "ssl-issuer",
        template: "ssl/detect-ssl-issuer.yaml",
        "matcher-name": "Let's Encrypt",
        type: "ssl",
        severity: "info",
        "matched-at": "example.com:443",
        host: "example.com",
        ip: "203.0.113.10",
        url: "https://example.com",
        scheme: "https",
        port: "443",
        path: "/",
        "extracted-results": ["C=US, O=Let's Encrypt, CN=R3"],
      },
    });
  });

  it("maps new metadata templates into stable finding kinds", () => {
    const txtMatch = parseNucleiJsonLine({
      "template-id": "txt-fingerprint",
      "template-path": "dns/txt-fingerprint.yaml",
      type: "dns",
      severity: "info",
      host: "example.com",
      "matched-at": "example.com",
      "extracted-results": ["v=spf1 include:_spf.example.com ~all"],
    });

    const rdapMatch = parseNucleiJsonLine({
      "template-id": "rdap-whois",
      "template-path": "http/miscellaneous/rdap-whois.yaml",
      type: "http",
      severity: "info",
      host: "example.com",
      url: "https://www.rdap.net/domain/example.com",
      "matched-at": "https://www.rdap.net/domain/example.com",
      "extracted-results": ["active", "2030-01-01T00:00:00Z"],
    });

    const robotsMatch = parseNucleiJsonLine({
      "template-id": "robots-txt",
      "template-path": "http/miscellaneous/robots-txt.yaml",
      type: "http",
      severity: "info",
      host: "example.com",
      url: "https://example.com/robots.txt",
      path: "/robots.txt",
      "matched-at": "https://example.com/robots.txt",
    });

    const replitMatch = parseNucleiJsonLine({
      "template-id": "replit-dns-verification",
      "template-path": "dns/replit-dns-verification.yaml",
      "matcher-name": "Replit",
      type: "dns",
      severity: "info",
      host: "example.com",
      "matched-at": "example.com",
      "extracted-results": ["replit-verify=00000000-0000-4000-8000-000000000000"],
    });

    const stackrayDnsServiceMatch = parseNucleiJsonLine({
      "template-id": "stackray-dns-service-detection",
      "template-path": "dns/stackray-dns-service-detection.yaml",
      "matcher-name": "Amazon Route 53",
      type: "dns",
      severity: "info",
      host: "example.com",
      "matched-at": "example.com",
      "extracted-results": ["ns-219.awsdns-27.com."],
    });

    const proofpointMatch = parseNucleiJsonLine({
      "template-id": "stackray-dns-service-detection",
      "template-path": "dns/stackray-dns-service-detection.yaml",
      "matcher-name": "Proofpoint",
      type: "dns",
      severity: "info",
      host: "example.com",
      "matched-at": "example.com",
      "extracted-results": ["v=spf1 include:%{ir}.%{v}.%{d}.spf.has.pphosted.com ~all"],
    });

    expect(txtMatch?.findingKind).toBe("txt_record");
    expect(rdapMatch?.findingKind).toBe("domain_metadata");
    expect(robotsMatch?.findingKind).toBe("robots_txt");
    expect(replitMatch?.findingKind).toBe("technology");
    expect(replitMatch?.technologyName).toBe("Replit");
    expect(stackrayDnsServiceMatch?.findingKind).toBe("dns_service");
    expect(stackrayDnsServiceMatch?.technologyName).toBeNull();
    expect(stackrayDnsServiceMatch?.subjectType).toBe("domain");
    expect(proofpointMatch?.findingKind).toBe("dns_service");
    expect(proofpointMatch?.matcherName).toBe("Proofpoint");
  });

  it("stamps execution subject metadata onto parsed matches", () => {
    const match = parseNucleiJsonLine({
      "template-id": "rdap-whois",
      type: "http",
      severity: "info",
      "matched-at": "https://www.rdap.net/domain/example.com",
    });

    expect(match).not.toBeNull();

    const withContext = withNucleiMatchExecutionContext(match!, {
      subject: "example.com",
      subjectType: "domain",
    });

    expect(withContext.subject).toBe("example.com");
    expect(withContext.subjectType).toBe("domain");
  });
});

describe("runNucleiCli", () => {
  it("terminates the child process and returns aborted when the abort signal fires", async () => {
    const controller = new AbortController();
    const process = new FakeNucleiProcess();
    const run = runNucleiCli({
      command: "nuclei",
      args: [],
      timeoutMs: 30_000,
      signal: controller.signal,
      spawnProcess: () => process,
      onJsonLine: () => {},
    });

    controller.abort();
    process.close(0);

    await expect(run).resolves.toMatchObject({
      status: "aborted",
    });
    expect(process.killSignals).toContain("SIGTERM");
  });
});
