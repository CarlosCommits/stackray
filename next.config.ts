import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["192.168.1.203", "mini", "100.90.230.40"],
};

export default nextConfig;
