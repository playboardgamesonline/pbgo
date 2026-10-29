import "server-only"
import { unstable_cache } from "next/cache"
import { loadMemberCount, loadOnlinePlayerCount } from "@pbgo/core/server/stats"

/** The figures local development shows when there is nothing to count (no Supabase here): made up, so that the design of the hero can be seen. */
const DEV_ONLINE = 128
const DEV_MEMBERS = 12_480

/** How long a count is kept before the next page asks again, in seconds: the players connected now for a minute, the accounts as long as the catalog is. */
const ONLINE_SECONDS = 60
const MEMBERS_SECONDS = 600

const onlineCounted = unstable_cache(loadOnlinePlayerCount, ["hub-online-players"], { revalidate: ONLINE_SECONDS, tags: ["hub-online-players"] })
const membersCounted = unstable_cache(loadMemberCount, ["hub-members"], { revalidate: MEMBERS_SECONDS, tags: ["hub-members"] })

/** One figure: counted, or left out (`null`) and never made up, except in local development, which has no Supabase and shows `fallback`. */
async function figureOf(name: string, count: () => Promise<number>, fallback: number): Promise<number | null> {
  try {
    return await count()
  } catch (error) {
    if (process.env.NODE_ENV !== "production") return fallback
    console.warn(`[hub] the ${name} could not be counted, the figure is left out:`, error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * The figures under the title of the home (`Stats`) that come from Supabase: the players connected now (`online_player_count()`, kept a minute) and the accounts registered
 * (`member_count()`, kept ten, both of migration `0003_hub_figures.sql`). A figure that cannot be counted is `null` and the page leaves it out; so does a deployment where the migration is not applied
 * yet, until `pnpm setup-env` applies it (`docs/supabase-and-env.md`). The figure of the games is the size of the catalog, which the page counts itself.
 */
export async function getHubFigures(): Promise<{ online: number | null; members: number | null }> {
  const [online, members] = await Promise.all([figureOf("players online", onlineCounted, DEV_ONLINE), figureOf("members", membersCounted, DEV_MEMBERS)])
  return { online, members }
}

/** A figure as it is written on the page: `12,480`. */
export const figure = (value: number) => new Intl.NumberFormat("en").format(value)
