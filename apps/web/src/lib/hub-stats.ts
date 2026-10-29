import "server-only"
import { unstable_cache } from "next/cache"
import { loadPlayerCount } from "@pbgo/core/server/stats"

/** The figure local development shows when there is nothing to count (no Supabase here): made up, so that the design of the hero can be seen. */
const DEV_PLAYERS = 12_480

/** How long a count is kept before the next page asks again, in seconds: as long as the catalog is. */
const REVALIDATE_SECONDS = 600

const counted = unstable_cache(loadPlayerCount, ["hub-player-count"], { revalidate: REVALIDATE_SECONDS, tags: ["hub-player-count"] })

/**
 * How many players the platform has had, for the figure under the title of the home (`Stats`): counted in Supabase (`player_count()`, migration `0003`), kept ten minutes.
 * When it cannot be counted the figure is left out (`null`) and never made up, except in local development, which has no Supabase and shows `DEV_PLAYERS` so that the hero can be seen.
 * A deployment where the migration is not applied yet leaves it out too, until `pnpm setup-env` applies it (`docs/supabase-and-env.md`).
 */
export async function getPlayerCount(): Promise<number | null> {
  try {
    return await counted()
  } catch (error) {
    if (process.env.NODE_ENV !== "production") return DEV_PLAYERS
    console.warn("[hub] the players could not be counted, the figure is left out:", error instanceof Error ? error.message : error)
    return null
  }
}

/** A figure as it is written on the page: `12,480`. */
export const figure = (value: number) => new Intl.NumberFormat("en").format(value)
