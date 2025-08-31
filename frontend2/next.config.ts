import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx"],
  turbopack: { root: __dirname },
};

export default nextConfig;
