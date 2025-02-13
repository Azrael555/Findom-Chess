import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  eslint: {
    ignoreDuringBuilds: true, // 🚀 Ignores ESLint errors in Vercel
  },
  typescript: {
    ignoreBuildErrors: true, // 🚀 Ignores TypeScript errors in Vercel
  },

};


export default nextConfig;
