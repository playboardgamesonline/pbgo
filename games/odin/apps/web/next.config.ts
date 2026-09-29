import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@odin/engine"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
}

export default nextConfig
