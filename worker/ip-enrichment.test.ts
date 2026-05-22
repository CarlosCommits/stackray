// @vitest-environment node

import { describe, expect, it } from "vitest";

import { isPrivateOrSpecialIp } from "@/worker/ip-enrichment";

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
    expect(isPrivateOrSpecialIp("2001:db8::1")).toBe(true);
    expect(isPrivateOrSpecialIp("fc00::1")).toBe(true);
    expect(isPrivateOrSpecialIp("fe80::1")).toBe(true);
    expect(isPrivateOrSpecialIp("ff02::1")).toBe(true);
    expect(isPrivateOrSpecialIp("2606:4700:4700::1111")).toBe(false);
  });
});
