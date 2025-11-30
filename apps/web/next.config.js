/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@chefcloud/contracts'],
  // Exclude test files from build
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'].map(ext => ext).filter(ext => !ext.includes('.test.')),
  webpack: (config, { isServer }) => {
    // Exclude test files from webpack bundling
    config.module.rules.push({
      test: /\.(test|spec)\.(ts|tsx|js|jsx)$/,
      loader: 'ignore-loader',
    });
    return config;
  },
};

module.exports = nextConfig;
