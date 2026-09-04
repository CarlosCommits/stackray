import type { NextConfig } from "next";

const allowedDevOrigins = (process.env.STACKRAY_ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  output: "standalone",
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
  async headers() {
    return [
      {
        source: "/email-assets/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
