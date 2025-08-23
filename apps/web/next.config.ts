import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const backend = process.env.BACKEND_URL || 'http://localhost:8000'; // dev fallback
    // If your FastAPI routes are *under* /api, use `${backend}/api/:path*` instead.
    return [{ source: '/api/:path*', destination: `${backend}/:path*` }];
  },
};
export default nextConfig;


