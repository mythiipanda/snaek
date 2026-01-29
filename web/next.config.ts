import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    domains: ["static.wikia.nocookie.net"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "static.wikia.nocookie.net",
      },
    ],
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
