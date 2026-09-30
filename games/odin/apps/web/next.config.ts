import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@odin/engine", "@pbgo/site"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
}

export default nextConfig
