import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@skyjo/engine"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
}

export default nextConfig
