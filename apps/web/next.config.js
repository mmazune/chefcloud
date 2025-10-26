/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@chefcloud/contracts'],
};

module.exports = nextConfig;
