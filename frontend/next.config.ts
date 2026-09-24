import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  rewrites() {
    return [{ source: "/api/backend/:path*", destination: `${backendUrl}/:path*` }];
  },
};

export default nextConfig;
