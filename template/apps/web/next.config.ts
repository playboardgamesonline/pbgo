import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@game/engine", "@pgo/engine-kit", "@pgo/ui", "@pgo/studio-kit", "@pgo/site"],
  async redirects() {
    return [{ source: "/to-do", destination: "/setup?tab=todo", permanent: false }]
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
}

export default nextConfig
