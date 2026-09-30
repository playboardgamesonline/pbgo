import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@hanabi/engine", "@pbgo/site"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
}

export default nextConfig
