import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@flip-7/engine"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
}

export default nextConfig
