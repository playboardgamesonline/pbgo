import type { NextConfig } from "next"
import { CONFIG, INGEST_PATH } from "@pbgo/analytics/config"
import { GAMES } from "@pbgo/games/registry"

/** The slugs of the registry as a path-to-regexp alternative: `skyjo|trio|6-nimmt|…`. */
const SLUGS = GAMES.map((game) => game.slug).join("|")

/**
 * PostHog behind the site's own domain (PLT-52): the browser talks to `/ingest`, so a blocker that lists PostHog's hosts does not
 * cut the statistics off and no request leaves for a third-party domain. Only with a valid key and host (`@pbgo/analytics/config`):
 * without them `/ingest` is not a route at all. PostHog's scripts and remote config come from its assets host, everything else
 * (events, recordings) from its ingest host. The order matters: the first match wins.
 */
const INGEST_REWRITES = CONFIG
  ? [
      { source: `${INGEST_PATH}/static/:path*`, destination: `${CONFIG.assetsHost}/static/:path*` },
      { source: `${INGEST_PATH}/array/:path*`, destination: `${CONFIG.assetsHost}/array/:path*` },
      { source: `${INGEST_PATH}/:path*`, destination: `${CONFIG.ingestHost}/:path*` },
    ]
  : []

/**
 * The only Next.js app: the hub (`/`, `/legal`), every game of the registry under `/<slug>` and the gamemaster, the back
 * office of all of them, under `/gamemaster`.
 * Workspace packages ship TypeScript sources, compiled by Next: the shared ones, then each game's binding and engine.
 */
const nextConfig: NextConfig = {
  transpilePackages: [
    "@pbgo/accounts",
    "@pbgo/analytics",
    "@pbgo/catalog",
    "@pbgo/core",
    "@pbgo/engine-kit",
    "@pbgo/games",
    "@pbgo/studio-kit",
    "@pbgo/table",
    "@pbgo/ui",
    ...GAMES.flatMap((game) => [`@pbgo-game/${game.slug}`, `@${game.slug}/engine`]),
  ],
  // Which deployment an analytics event comes from (production, preview or development), inlined at build time so the browser
  // knows it too. Outside Vercel there is no VERCEL_ENV: a local run is "development".
  env: { NEXT_PUBLIC_APP_ENV: process.env.VERCEL_ENV ?? "development" },
  // PostHog's endpoints end with a slash (`/ingest/e/`): the default redirect would strip it before the rewrite and break them.
  // It applies to the whole site: `/legal/` now answers like `/legal` instead of redirecting, and every page's canonical URL
  // (`alternates.canonical`, the sitemap) is an explicit string without the slash, so search engines still see one address.
  skipTrailingSlashRedirect: true,
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
      beforeFiles: [
        { source: `/gamemaster/:game(${SLUGS})/preview/:kind(home|game)`, destination: "/:game/preview/:kind" },
        // Before the files too, or `/ingest/...` would be read as the `[game]` route of a game called "ingest".
        ...INGEST_REWRITES,
      ],
    }
  },
  async headers() {
    // The gamemaster is never indexed. `/gamemaster/:path*` also matches `/gamemaster` itself.
    return [{ source: "/gamemaster/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }]
  },
}

export default nextConfig
