/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || '.next',
  experimental: {
    // Node 24 currently exits silently in Next 15's Unix build workers.
    // A single worker keeps production builds deterministic on Debian/macOS.
    cpus: 1,
  },
};

module.exports = nextConfig;
