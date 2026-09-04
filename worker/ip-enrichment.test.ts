// @vitest-environment node

import { describe, expect, it } from "vitest";

import { getTeamCymruOriginQueryName, isPrivateOrSpecialIp } from "@/worker/ip-enrichment";

describe("isPrivateOrSpecialIp", () => {
  it("filters private and special IPv4 ranges", () => {
    expect(isPrivateOrSpecialIp("10.0.0.1")).toBe(true);
    expect(isPrivateOrSpecialIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrSpecialIp("169.254.10.20")).toBe(true);
    expect(isPrivateOrSpecialIp("192.0.2.10")).toBe(true);
    expect(isPrivateOrSpecialIp("8.8.8.8")).toBe(false);
  });

  it("filters private and special IPv6 ranges", () => {
    expect(isPrivateOrSpecialIp("::")).toBe(true);
    expect(isPrivateOrSpecialIp("::1")).toBe(true);
    expect(isPrivateOrSpecialIp("::ffff:192.0.2.1")).toBe(true);
    expect(isPrivateOrSpecialIp("64:ff9b::192.0.2.1")).toBe(true);
    expect(isPrivateOrSpecialIp("2001:db8::1")).toBe(true);
    expect(isPrivateOrSpecialIp("2001::1")).toBe(true);
    expect(isPrivateOrSpecialIp("2002::1")).toBe(true);
    expect(isPrivateOrSpecialIp("fc00::1")).toBe(true);
    expect(isPrivateOrSpecialIp("fe80::1")).toBe(true);
    expect(isPrivateOrSpecialIp("ff02::1")).toBe(true);
    expect(isPrivateOrSpecialIp("2606:4700:4700::1111")).toBe(false);
  });
});

describe("getTeamCymruOriginQueryName", () => {
  it("uses the IPv4 origin zone with reversed octets", () => {
    expect(getTeamCymruOriginQueryName("8.8.8.8")).toBe("8.8.8.8.origin.asn.cymru.com");
  });

  it("uses the IPv6 origin zone with a full reversed-nibble address", () => {
    expect(getTeamCymruOriginQueryName("2607:f8b0:4004:c29::66")).toBe(
      "6.6.0.0.0.0.0.0.0.0.0.0.0.0.0.0.9.2.c.0.4.0.0.4.0.b.8.f.7.0.6.2.origin6.asn.cymru.com",
    );
  });

  it("rejects non-IP input", () => {
    expect(getTeamCymruOriginQueryName("example.com")).toBeNull();
  });
});
