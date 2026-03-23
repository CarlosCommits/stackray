import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/app",
        destination: "/dashboard",
        permanent: false,
      },
      {
        source: "/app/history",
        destination: "/history",
        permanent: false,
      },
      {
        source: "/app/search",
        destination: "/search",
        permanent: false,
      },
      {
        source: "/app/saved-searches",
        destination: "/saved-searches",
        permanent: false,
      },
      {
        source: "/app/scans/new",
        destination: "/scans/new",
        permanent: false,
      },
      {
        source: "/app/scans/:scanId",
        destination: "/scans/:scanId",
        permanent: false,
      },
      {
        source: "/app/settings/tokens",
        destination: "/settings/tokens",
        permanent: false,
      },
      {
        source: "/app/settings/workspace",
        destination: "/settings/workspace",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
