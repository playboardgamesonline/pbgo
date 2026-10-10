/**
 * Games served by the hub under playboardgamesonline.app/<slug>.
 *
 * Each game is its own Vercel project, built with `NEXT_PUBLIC_BASE_PATH=/<slug>` so that all its pages, assets and
 * API routes live under `/<slug>`. The hub rewrites `/<slug>/*` to that project's production URL.
 * Origin: `GAME_ORIGIN_<SLUG>` env var (e.g. GAME_ORIGIN_COURTISANS), else the default below.
 */
export type HubGame = {
  slug: string
  name: string
  tagline: string
  players: { min: number; max: number }
  /** Production URL of the game's Vercel project, without trailing slash. */
  defaultOrigin: string
  /** Shown on the hub home page. */
  listed: boolean
}

export const GAMES: HubGame[] = [
  {
    slug: "courtisans",
    name: "Courtisans",
    tagline: "The Queen's banquet, online with friends.",
    players: { min: 2, max: 5 },
    defaultOrigin: "https://courtisans.playboardgamesonline.vercel.app",
    listed: true,
  },
]

const envKey = (slug: string) => `GAME_ORIGIN_${slug.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`

export function gameOrigin(game: HubGame): string {
  return (process.env[envKey(game.slug)] ?? game.defaultOrigin).replace(/\/+$/, "")
}
