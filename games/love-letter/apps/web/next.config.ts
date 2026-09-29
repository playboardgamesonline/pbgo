import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@love-letter/engine"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
}

export default nextConfig
