import type { NextConfig } from "next";

// In production the browser talks to this site's own /api path and Next.js
// proxies it to the Express API, so auth cookies stay first-party.
// API_PROXY_TARGET is the API's origin, e.g. https://intervai-api.onrender.com
const apiProxyTarget = process.env.API_PROXY_TARGET?.trim().replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    if (!apiProxyTarget) return [];
    return [{ source: "/api/:path*", destination: `${apiProxyTarget}/api/:path*` }];
  },
};

export default nextConfig;
