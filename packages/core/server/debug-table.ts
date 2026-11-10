import "server-only"
import type { SavedState } from "../lib/game-types"

/**
 * The tools that move a table's state for a developer: keep it (`saveState`) and load it back into any table of the game with as many seats (`restoreState`), through the `state` and `load` commands of the debug route and the Table
 * folder of the panel. They exist where `debugEnabled` says so and nowhere else.
 */

/** Where the debug tools may run: not on a production deployment, unless `DEBUG_GAMES=1` says so (the debug route has always asked the same) */
export const debugEnabled = () => process.env.NODE_ENV !== "production" || process.env.DEBUG_GAMES === "1"

/** A state to keep: where it comes from, the seats in order, the state */
export const saveState = (slug: string, playerIds: readonly string[], state: unknown, now = new Date()): SavedState => ({ game: slug, players: [...playerIds], state, savedAt: now.toISOString() })

const escaped = (id: string) => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * A saved state for the seats of this table: every id of a saved seat replaced, wherever it is in the state, by the id of the seat that sits in the same place at this table. An id is a whole string in a lean state (a value or a key of an
 * object), so the match is on the quoted id, in one pass: two seats that swap places swap correctly. Throws `RangeError` for something that is not a state saved from this game or that has another number of seats.
 */
export function restoreState(saved: unknown, slug: string, playerIds: readonly string[]): unknown {
  const { game, players, state } = (saved && typeof saved === "object" ? saved : {}) as Partial<SavedState>
  if (game !== slug) throw new RangeError("This state was saved from another game")
  if (!Array.isArray(players) || players.some((id) => typeof id !== "string") || new Set(players).size !== players.length) throw new RangeError("The seats of this state are not a list of different ids")
  if (players.length !== playerIds.length) throw new RangeError(`This state has ${players.length} seats and the table has ${playerIds.length}`)
  if (state === null || typeof state !== "object") throw new RangeError("This state holds no state")
  const seats = new Map(players.map((id, i) => [id, playerIds[i]!]))
  const pattern = new RegExp(`"(${[...seats.keys()].map(escaped).join("|")})"`, "g")
  return JSON.parse(JSON.stringify(state).replace(pattern, (_, id: string) => JSON.stringify(seats.get(id))))
}
