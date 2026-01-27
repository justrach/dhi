import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable async WASM for Edge runtime
  // This allows dhi to load its WASM module at build time
  webpack: (config, { isServer }) => {
    // Enable WASM experiments
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Fix WASM loading for Edge runtime
    config.module.rules.push({
      test: /\.wasm$/,
      type: "asset/resource",
    });

    return config;
  },

  // Transpile dhi for proper ESM handling
  transpilePackages: ["dhi"],
};

export default nextConfig;
