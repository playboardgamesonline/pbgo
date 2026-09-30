import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // @pbgo/core importe le jeu via ces alias (binding-server : côté serveur uniquement)
  turbopack: {
    resolveAlias: { "@pbgo/binding": "./src/binding.ts", "@pbgo/binding-ui": "./src/binding-ui.ts", "@pbgo/binding-server": "./src/binding-server.ts" },
  },
  transpilePackages: ["@pbgo/core", "@game/engine", "@pbgo/engine-kit", "@pbgo/ui", "@pbgo/studio-kit", "@pbgo/site"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
}

export default nextConfig
