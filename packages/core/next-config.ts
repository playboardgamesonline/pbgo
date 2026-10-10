import type { NextConfig } from "next"

/** Workspace packages a game on @pbgo/core imports as TypeScript sources. */
const CORE_PACKAGES = ["@pbgo/core", "@pbgo/engine-kit", "@pbgo/ui", "@pbgo/studio-kit", "@pbgo/site"]

/**
 * next.config of every game: `export default createNextConfig({ engine: "@<game>/engine", core: true })`.
 * - `engine`: the game's engine package, compiled by Next like the shared packages
 * - `core`: the app runs on @pbgo/core (false for "shell" games that only use @pbgo/site)
 */
export function createNextConfig({ engine, core = false }: { engine: string; core?: boolean }): NextConfig {
  // Served under the hub (playboardgamesonline.app/<slug>) when NEXT_PUBLIC_BASE_PATH is set, e.g. "/courtisans".
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "") || undefined
  return {
    basePath,
    transpilePackages: [engine, ...(core ? CORE_PACKAGES : ["@pbgo/site"])],
    images: {
      remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
    },
    ...(core && {
      // @pbgo/core imports the game through these aliases (binding-server: server only), mirrored in the app's tsconfig "paths"
      turbopack: {
        resolveAlias: { "@pbgo/binding": "./src/binding.ts", "@pbgo/binding-ui": "./src/binding-ui.ts", "@pbgo/binding-server": "./src/binding-server.ts" },
      },
    }),
  }
}
