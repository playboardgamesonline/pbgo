import type { NextConfig } from "next"
import { GAMES } from "@pbgo/games/registry"

/** The slugs of the registry as a path-to-regexp alternative: `skyjo|trio|6-nimmt|…`. */
const SLUGS = GAMES.map((game) => game.slug).join("|")

/**
 * The only Next.js app: the hub (`/`, `/legal`), every game of the registry under `/<slug>` and the gamemaster, the back
 * office of all of them, under `/gamemaster`.
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
    // app/global-not-found.tsx: the hub, the games and the gamemaster have separate root layouts
    globalNotFound: true,
  },
  async redirects() {
    return [
      // Each game used to have its own admin at /<slug>/admin: old links and bookmarks land in the gamemaster. The bare URL
      // goes straight to the first page (Identity), so it costs one redirect instead of two.
      { source: `/:game(${SLUGS})/admin`, destination: "/gamemaster/:game/identity", permanent: true },
      { source: `/:game(${SLUGS})/admin/:path+`, destination: "/gamemaster/:game/:path+", permanent: true },
    ]
  },
  async rewrites() {
    return {
      // The previews of Setup (iframes) are served below /gamemaster, where the session cookie is sent, but they are pages of the
      // game and render in its layout and skin: /gamemaster/<slug>/preview/<kind> → app/[game]/preview/[kind]. Before the files,
      // or the gamemaster's own /gamemaster/[game]/[[...section]] page would answer first.
      beforeFiles: [{ source: `/gamemaster/:game(${SLUGS})/preview/:kind(home|game)`, destination: "/:game/preview/:kind" }],
    }
  },
  async headers() {
    // The gamemaster is never indexed. `/gamemaster/:path*` also matches `/gamemaster` itself.
    return [{ source: "/gamemaster/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }]
  },
}

export default nextConfig
