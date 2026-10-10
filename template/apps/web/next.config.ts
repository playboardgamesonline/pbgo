import type { NextConfig } from "next"

// Served under the hub (playboardgamesonline.app/<slug>) when NEXT_PUBLIC_BASE_PATH is set, e.g. "/courtisans".
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "") || undefined

const nextConfig: NextConfig = {
  basePath,
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
