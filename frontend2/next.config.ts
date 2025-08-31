import type { NextConfig } from "next";
import createMDX from "@next/mdx";

// Use Next's MDX-RS pipeline to avoid requiring '@mdx-js/loader'
const withMDX = createMDX({
  extension: /.mdx?$/,
});

const nextConfig: NextConfig = {
  // Include MD files if needed alongside MDX
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  // Silence workspace root warning for multiple lockfiles by pinning root here
  turbopack: {
    root: __dirname,
  },
};

export default withMDX(nextConfig);
