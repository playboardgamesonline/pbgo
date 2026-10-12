import type { NextConfig } from "next"
import { GAMES } from "@pbgo/games/registry"

/**
 * The only Next.js app: the hub (`/`, `/legal`) and every game of the registry under `/<slug>`.
 * Workspace packages ship TypeScript sources, compiled by Next: the shared ones, then each game's binding and engine.
 */
const nextConfig: NextConfig = {
  transpilePackages: [
    "@pbgo/core",
    "@pbgo/engine-kit",
    "@pbgo/games",
    "@pbgo/studio-kit",
    "@pbgo/ui",
    ...GAMES.flatMap((game) => [`@pbgo-game/${game.slug}`, `@${game.slug}/engine`]),
  ],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
  experimental: {
    // app/global-not-found.tsx: the hub and the games have separate root layouts
    globalNotFound: true,
  },
}

export default nextConfig
