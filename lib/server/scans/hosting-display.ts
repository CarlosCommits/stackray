import {
  getHostFromCnames,
  getHostFromServerBanner,
  isCdnLikeTechnology,
  isHostLikeTechnology,
} from "@/lib/server/scans/technology-catalog";

type HostingTechnologyDetection = {
  name: string;
  categories: readonly string[];
};

type HostingDisplayInput = {
  server: string | null;
  cdn: {
    name: string | null;
  } | null;
  dns: {
    cname: readonly string[];
  } | null;
  asn: {
    org: string | null;
  } | null;
  technologyDetections: readonly HostingTechnologyDetection[];
};

function normalizeProviderName(value: string | null) {
  return value?.toLowerCase().replace(/[^a-z0-9]+/g, "") ?? null;
}

export function resolveHostingDisplay(result: HostingDisplayInput) {
  return {
    server: resolveLikelyHost(result),
    cdnName: resolveLikelyCdn(result),
  };
}

function resolveLikelyHost(result: HostingDisplayInput) {
  for (const detection of result.technologyDetections) {
    if (isHostLikeTechnology(detection.name, detection.categories)) {
      return detection.name;
    }
  }

  const bannerHost = getHostFromServerBanner(result.server);

  if (bannerHost) {
    return bannerHost;
  }

  const cnameHost = getHostFromCnames(result.dns?.cname ?? []);

  if (cnameHost) {
    return cnameHost;
  }

  if (result.asn?.org && normalizeProviderName(result.asn.org) !== normalizeProviderName(result.cdn?.name ?? null)) {
    return result.asn.org;
  }

  return null;
}

function resolveLikelyCdn(result: HostingDisplayInput) {
  if (result.cdn?.name) {
    return result.cdn.name;
  }

  for (const detection of result.technologyDetections) {
    if (isCdnLikeTechnology(detection.categories)) {
      return detection.name;
    }
  }

  return null;
}
