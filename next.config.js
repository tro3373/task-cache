/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  webpack: (config) => {
    // Ignore .cursorignore and other problematic files during build
    config.module.rules.push({
      test: /\.cursorignore$/,
      use: 'ignore-loader',
    });
    return config;
  },
};

module.exports = nextConfig;
