import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // lets a production build run next to `next dev` (NEXT_DIST_DIR=.next-build)
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // pg is a Node-only dependency used by the API route handlers
  serverExternalPackages: ['pg'],
  images: { unoptimized: true },
};

export default nextConfig;
