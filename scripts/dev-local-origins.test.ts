// @vitest-environment node

import type { NetworkInterfaceInfo } from "node:os";

import { describe, expect, it } from "vitest";

import { buildAllowedDevOrigins, parseDotEnvValue } from "./dev-local-origins";

type IPv4NetworkInterfaceInfo = Extract<NetworkInterfaceInfo, { family: "IPv4" }>;

function address(overrides: Partial<IPv4NetworkInterfaceInfo>): IPv4NetworkInterfaceInfo {
  return {
    address: "192.168.1.10",
    cidr: "192.168.1.10/24",
    family: "IPv4",
    internal: false,
    mac: "00:00:00:00:00:00",
    netmask: "255.255.255.0",
    ...overrides,
  };
}

describe("buildAllowedDevOrigins", () => {
  it("merges configured, host, LAN, and Tailscale identities", () => {
    expect(buildAllowedDevOrigins({
      configuredOrigins: "custom.local, https://Preview.Local:3000,custom.local",
      fqdn: "mini.example.test",
      hostname: "mini",
      interfaces: {
        eno1: [address({ address: "192.168.1.203" })],
        tailscale0: [address({ address: "100.90.230.40", netmask: "255.255.255.255" })],
      },
      tailscaleDnsName: "mini.tailnet.ts.net.",
      tailscaleIps: ["100.90.230.40", "fd7a:115c:a1e0::1"],
    })).toEqual([
      "custom.local",
      "preview.local",
      "mini",
      "mini.example.test",
      "192.168.1.203",
      "100.90.230.40",
      "mini.tailnet.ts.net",
      "[fd7a:115c:a1e0::1]",
    ]);
  });

  it("excludes loopback and container bridge interfaces", () => {
    expect(buildAllowedDevOrigins({
      hostname: "stackray-dev",
      interfaces: {
        "br-abc123": [address({ address: "172.19.0.1" })],
        docker0: [address({ address: "172.17.0.1" })],
        eno1: [address({ address: "192.168.1.203" })],
        lo: [address({ address: "127.0.0.1", internal: true })],
        veth123: [address({ address: "172.20.0.1" })],
      },
    })).toEqual(["stackray-dev", "192.168.1.203"]);
  });
});

describe("parseDotEnvValue", () => {
  it("reads quoted, exported, and unquoted values", () => {
    expect(parseDotEnvValue('STACKRAY_ALLOWED_DEV_ORIGINS="mini,192.168.1.2"', "STACKRAY_ALLOWED_DEV_ORIGINS"))
      .toBe("mini,192.168.1.2");
    expect(parseDotEnvValue("export STACKRAY_ALLOWED_DEV_ORIGINS=mini # local host", "STACKRAY_ALLOWED_DEV_ORIGINS"))
      .toBe("mini");
  });
});
