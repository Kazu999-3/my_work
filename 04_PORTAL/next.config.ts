import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/admin/design': ['./public/design_docs/**/*'],
  },
};

export default nextConfig;
