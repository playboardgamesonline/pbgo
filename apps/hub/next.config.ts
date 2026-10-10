import type { NextConfig } from "next"
import { GAMES, gameOrigin } from "./src/games"

/**
 * Single domain, one Vercel project per game (Next.js multi-zones):
 * playboardgamesonline.app/<slug>/* is proxied to the game's own deployment, which runs with basePath "/<slug>".
 */
const nextConfig: NextConfig = {
  async rewrites() {
    return GAMES.flatMap((game) => {
      const origin = gameOrigin(game)
      return [
        { source: `/${game.slug}`, destination: `${origin}/${game.slug}` },
        { source: `/${game.slug}/:path+`, destination: `${origin}/${game.slug}/:path+` },
      ]
    })
  },
}

export default nextConfig
