import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@timebomb/engine", "@pgo/site"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
}

export default nextConfig
