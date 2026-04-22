import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Prevent Turbopack from inferring the monorepo root (workspace has multiple lockfiles).
    root: __dirname,
  },
};

export default nextConfig;
