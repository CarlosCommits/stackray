import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { hostname, networkInterfaces, type NetworkInterfaceInfo } from "node:os";

type LocalNetworkInterfaces = NodeJS.Dict<NetworkInterfaceInfo[]>;

type AllowedDevOriginsInput = {
  configuredOrigins?: string;
  fqdn?: string;
  hostname?: string;
  interfaces?: LocalNetworkInterfaces;
  tailscaleDnsName?: string;
  tailscaleIps?: readonly string[];
};

type TailscaleStatus = {
  Self?: {
    DNSName?: unknown;
    TailscaleIPs?: unknown;
  };
};

const virtualInterfacePrefixes = ["br-", "cni", "docker", "flannel", "podman", "veth", "virbr"];

function isVirtualContainerInterface(name: string) {
  return virtualInterfacePrefixes.some((prefix) => name.toLowerCase().startsWith(prefix));
}

function normalizeOrigin(value: string) {
  const trimmed = value.trim().replace(/\.$/, "");
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes("://")) {
    try {
      return new URL(trimmed).hostname.toLowerCase();
    } catch {
      return null;
    }
  }

  if (/\s|\//.test(trimmed)) {
    return null;
  }

  return trimmed.toLowerCase();
}

function normalizeIpOrigin(address: string) {
  return address.includes(":") ? `[${address.toLowerCase()}]` : address;
}

export function buildAllowedDevOrigins({
  configuredOrigins,
  fqdn,
  hostname: machineHostname,
  interfaces = {},
  tailscaleDnsName,
  tailscaleIps = [],
}: AllowedDevOriginsInput) {
  const origins = new Set<string>();
  const add = (value?: string) => {
    if (!value) {
      return;
    }

    const normalized = normalizeOrigin(value);
    if (normalized) {
      origins.add(normalized);
    }
  };

  for (const origin of configuredOrigins?.split(",") ?? []) {
    add(origin);
  }

  add(machineHostname);
  add(fqdn);

  for (const [name, addresses] of Object.entries(interfaces)) {
    if (isVirtualContainerInterface(name)) {
      continue;
    }

    for (const address of addresses ?? []) {
      if (!address.internal && address.family === "IPv4") {
        add(address.address);
      }
    }
  }

  add(tailscaleDnsName);
  for (const address of tailscaleIps) {
    add(normalizeIpOrigin(address));
  }

  return [...origins];
}

export function parseDotEnvValue(contents: string, name: string) {
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[1] !== name) {
      continue;
    }

    const rawValue = match[2].trim();
    const quote = rawValue[0];
    if ((quote === "\"" || quote === "'") && rawValue.endsWith(quote)) {
      return rawValue.slice(1, -1);
    }

    return rawValue.replace(/\s+#.*$/, "").trim();
  }

  return undefined;
}

async function readConfiguredOrigins() {
  if (process.env.STACKRAY_ALLOWED_DEV_ORIGINS !== undefined) {
    return process.env.STACKRAY_ALLOWED_DEV_ORIGINS;
  }

  for (const path of [".env.local", ".env"]) {
    try {
      const value = parseDotEnvValue(await readFile(path, "utf8"), "STACKRAY_ALLOWED_DEV_ORIGINS");
      if (value !== undefined) {
        return value;
      }
    } catch (error) {
      const errorCode = error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (errorCode !== "ENOENT") {
        throw error;
      }
    }
  }

  return undefined;
}

function runOptional(command: string, args: string[]) {
  return new Promise<string | undefined>((resolve) => {
    execFile(command, args, { timeout: 1_500 }, (error, stdout) => {
      resolve(error ? undefined : stdout.trim());
    });
  });
}

async function readTailscaleStatus() {
  const rawStatus = await runOptional("tailscale", ["status", "--json"]);
  if (!rawStatus) {
    return {};
  }

  try {
    const status = JSON.parse(rawStatus) as TailscaleStatus;
    const dnsName = typeof status.Self?.DNSName === "string" ? status.Self.DNSName : undefined;
    const ips = Array.isArray(status.Self?.TailscaleIPs)
      ? status.Self.TailscaleIPs.filter((value): value is string => typeof value === "string")
      : [];

    return { dnsName, ips };
  } catch {
    return {};
  }
}

export async function resolveAllowedDevOrigins() {
  const [configuredOrigins, fqdn, tailscale] = await Promise.all([
    readConfiguredOrigins(),
    runOptional("hostname", ["-f"]),
    readTailscaleStatus(),
  ]);

  return buildAllowedDevOrigins({
    configuredOrigins,
    fqdn,
    hostname: hostname(),
    interfaces: networkInterfaces(),
    tailscaleDnsName: tailscale.dnsName,
    tailscaleIps: tailscale.ips,
  });
}
