import "server-only"
import { unstable_cache } from "next/cache"
import type { HubFigures } from "@pbgo/core/lib/hub-figures"
import { loadMemberCount, loadOnlinePlayerCount } from "@pbgo/core/server/stats"

/** The figures local development shows when there is nothing to count (no Supabase here): made up, so that the design of the hero can be seen. */
const DEV_ONLINE = 128
const DEV_MEMBERS = 12_480

/**
 * How long a count is kept before the next page asks again, in seconds: the players online for half a minute, the accounts for a minute. The browser asks again every half minute (`LiveStats`), so this is how old
 * what it gets can be, at most, with the few seconds that the edge keeps the answer of `GET /api/hub/figures`.
 */
const ONLINE_SECONDS = 30
const MEMBERS_SECONDS = 60

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
 * The figures under the title of the home (`LiveStats`) that come from Supabase: the players online (`online_player_count()`: the members seen on the site in the last two minutes or seated at a table, and the guests
 * seated at a table, kept half a minute) and the accounts registered (`member_count()`, kept a minute), both of migrations `0003_hub_figures.sql` and `0005_online_players.sql`. A figure that cannot be counted is `null` and the page
 * leaves it out; so does a deployment where the migrations are not applied yet, until `pnpm setup-env` applies them (`docs/supabase-and-env.md`). The figure of the games is the size of the catalog, which the page counts itself.
 */
export async function getHubFigures(): Promise<HubFigures> {
  const [online, members] = await Promise.all([figureOf("players online", onlineCounted, DEV_ONLINE), figureOf("members", membersCounted, DEV_MEMBERS)])
  return { online, members }
}
