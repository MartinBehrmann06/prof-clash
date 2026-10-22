import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // lets a production build run next to `next dev` (NEXT_DIST_DIR=.next-build)
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // pg is a Node-only dependency used by the API route handlers
  serverExternalPackages: ['pg'],
  images: { unoptimized: true },
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        // no framing (clickjacking), no MIME sniffing, no full URLs leaked to other sites.
        // Pages get the full Content-Security-Policy with a script nonce from middleware.ts.
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        // no other window keeps a handle on ours
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      ],
    }];
  },
  // old routes from earlier versions
  async redirects() {
    return [
      { source: '/leaderboard', destination: '/rankings', permanent: false },
      { source: '/dev/arena', destination: '/battle', permanent: false },
    ];
  },
};

export default nextConfig;
