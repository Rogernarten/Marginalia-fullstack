import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // /api/explain reads the book from public/book on the server (lib/explain/server.ts).
  outputFileTracingIncludes: {
    "/api/explain": ["./public/book/**/*"],
  },
};

export default nextConfig;
