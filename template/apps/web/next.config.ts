import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // @pgo/core importe le jeu via ces deux alias
  turbopack: {
    resolveAlias: { "@pgo/binding": "./src/binding.ts", "@pgo/binding-ui": "./src/binding-ui.ts" },
  },
  transpilePackages: ["@pgo/core", "@game/engine", "@pgo/engine-kit", "@pgo/ui", "@pgo/studio-kit", "@pgo/site"],
  async redirects() {
    return [{ source: "/to-do", destination: "/setup?tab=todo", permanent: false }]
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
}

export default nextConfig
