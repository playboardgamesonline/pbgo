import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@welcome-to/engine"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
}

export default nextConfig
