import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@flip-7/engine", "@pgo/site"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
}

export default nextConfig
