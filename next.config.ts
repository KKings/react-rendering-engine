import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  
  images: {
    remotePatterns: [new URL('https://picsum.photos/**')],
  },
};

export default nextConfig;
