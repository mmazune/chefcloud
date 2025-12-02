/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@chefcloud/contracts'],
  // Only include production page files
  pageExtensions: ['page.tsx', 'page.ts', 'page.jsx', 'page.js', 'tsx', 'ts', 'jsx', 'js'],
  webpack: (config, { isServer }) => {
    // Exclude test files and __tests__ directories from webpack bundling
    config.module.rules.push({
      test: /\.(test|spec)\.(ts|tsx|js|jsx)$/,
      loader: 'ignore-loader',
    });
    
    // Exclude __tests__ directories
    config.module.rules.push({
      test: /[\\/]__tests__[\\/]/,
      loader: 'ignore-loader',
    });
    
    return config;
  },
};

module.exports = nextConfig;
