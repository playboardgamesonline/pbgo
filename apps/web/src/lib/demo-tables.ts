import type { CatalogEntry } from "@pbgo/catalog"
import type { MemberTable } from "@pbgo/core/server/tables"

// The made-up tables of the demo account of development (`@pbgo/accounts/demo`), so that the member's tables on the signed-in home can be seen on a machine where the demo account, which is in no database, sits at none: a lobby that waits
// and a game in progress, on the first live games of the catalog, with players named like the ones a real table has. The demo account does not exist in a deployment, so none of this ever reaches one.

const MINUTE_MS = 60_000

/** The demo account's tables: a lobby it opened with one friend, and a game in progress it plays with two. `name` is how the account is called at a table. */
export function demoTables(entries: readonly CatalogEntry[], name: string, now = Date.now()): MemberTable[] {
  const minutesAgo = (minutes: number) => new Date(now - minutes * MINUTE_MS).toISOString()
  const [first, second] = entries.filter((entry) => entry.live)
  const lobby = first
    ? [
        {
          game: first.slug,
          code: "DEMO23",
          status: "lobby" as const,
          hostId: "demo-me",
          seat: "demo-me",
          players: [
            { id: "demo-me", nickname: name },
            { id: "demo-herve", nickname: "herve_74" },
          ],
          options: {},
          createdAt: minutesAgo(6),
          updatedAt: minutesAgo(2),
        },
      ]
    : []
  const game = second ?? first
  const playing = game
    ? [
        {
          game: game.slug,
          code: "DEMO45",
          status: "playing" as const,
          hostId: "demo-marly",
          seat: "demo-me-2",
          players: [
            { id: "demo-marly", nickname: "marly_b" },
            { id: "demo-me-2", nickname: name },
            { id: "demo-sam", nickname: "sam.le.rouge" },
          ],
          options: {},
          createdAt: minutesAgo(31),
          updatedAt: minutesAgo(1),
        },
      ]
    : []
  return [...lobby, ...playing]
}
