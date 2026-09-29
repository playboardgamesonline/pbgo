import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@cry-baby/engine"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
}

export default nextConfig
