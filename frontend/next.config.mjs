/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['images.bhumi.trilok.ai'],
  },
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Add support for WASM modules
    config.module.rules.push({
      test: /\.wasm/,
      type: 'asset/resource',
      generator: {
        filename: 'static/wasm/[hash][ext][query]'
      }
    });


    return config;
  },
}

export default nextConfig; 