import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // @pgo/core importe le jeu via ces alias (binding-server : côté serveur uniquement)
  turbopack: {
    resolveAlias: { "@pgo/binding": "./src/binding.ts", "@pgo/binding-ui": "./src/binding-ui.ts", "@pgo/binding-server": "./src/binding-server.ts" },
  },
  transpilePackages: ["@pgo/core", "@courtisans/engine", "@pgo/engine-kit", "@pgo/ui", "@pgo/studio-kit", "@pgo/site"],
  async redirects() {
    return [
      // anciens liens d'invitation (avant @pgo/core)
      { source: "/partie/:code", destination: "/game/:code", permanent: true },
      { source: "/to-do", destination: "/setup?tab=todo", permanent: false },
    ]
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
}

export default nextConfig
