import type { PlayerInfo } from "@pbgo/engine-kit"
import type { GameStatus } from "./game-types"

/**
 * The start screen (PLT-107) is the platform's, over the board of a table: the board is drawn behind it and loads, each player confirms that they are there with a button, a player is ready when they have and their board is loaded, and the screen
 * goes away, for everybody at once, when the last one is. Nothing is automatic: a player who does not press is not ready, and is unseated when the time is up. This is its logic, pure and tested; `BoardEntry` and `StartScreen` draw it.
 */

/** How long a board is waited for to say it is loaded (`BoardProps.onLoaded`) before it counts as loaded anyway: a slow line, or a board that does not report, is not a reason to hold the others or to be unseated. */
export const READY_LOAD_GRACE_MS = 20_000

/**
 * - `confirm`: a table in its ready check, and the player has not said they are there: the button is theirs, whatever the board is doing
 * - `loading`: the player said so and their board is not loaded yet (a game under way that they come back to has the same state: its board is what is waited for)
 * - `waiting`: they are ready, or will be as soon as the table has heard, and the game waits for the others
 * - `lifted`: the screen is gone, the board plays
 */
export type CurtainState = "confirm" | "loading" | "waiting" | "lifted"

/**
 * Where the start screen stands. `confirmed`: the player pressed the button. `marked`: the table has the player down as ready (it needs both the press and a loaded board, so a page that is opened again after it is not asked twice). `loaded`: their board said so, or the
 * grace is over.
 * - A table in its ready check keeps the screen up for everybody until the game begins, whoever is ready and whoever is not, and asks each player to press first: a board that is loaded does not make a player ready, and a press made before their board is loaded is kept
 *   until it is (`loading`, then `waiting`).
 * - A game under way (the player came back to it) has no button and no barrier: the screen goes as soon as their own board is there.
 * - A game that is over shows its end with no screen.
 */
export function curtainState({ status, confirmed, marked, loaded }: { status: GameStatus; confirmed: boolean; marked: boolean; loaded: boolean }): CurtainState {
  if (status === "over") return "lifted"
  if (status === "playing") return loaded ? "lifted" : "loading"
  if (marked) return "waiting"
  if (!confirmed) return "confirm"
  return loaded ? "waiting" : "loading"
}

/** What the screen says of a table in its ready check, as the player stands in it. */
export type CheckWords = {
  title: string
  subtitle: string
  /** The button: "I'm here" while it is theirs to press, then what is left of the wait (it is disabled, with a spinner, from the press on) */
  button: string
}

/** The words of the start screen for a table in its ready check, for each state the player can be in. Platform texts, English until the language pass (PLT-32). */
export function checkWords(state: Exclude<CurtainState, "lifted">): CheckWords {
  const subtitle = "The game starts when every player has confirmed."
  switch (state) {
    case "confirm":
      return { title: "Are you there?", subtitle, button: "I'm here" }
    case "loading":
      return { title: "Setting up the table", subtitle, button: "Waiting for the others" }
    case "waiting":
      return { title: "Waiting for the other players", subtitle, button: "Waiting for the others" }
  }
}

/**
 * What became of a ready check, as the page of the table reads it. `sawCheck`: the page saw the table `starting`; `began`: it saw the game begin (`playing` or `over`); `status` and `players` are the table as it was read last, and `unknown` is that the table is no
 * longer there to be read. Null while the check is not over, was never seen, or ended in a game.
 * - `table`: the table is back in the lobby, with the players who were ready, and the player who was not is no longer seated. It is where they go.
 * - `game`: nobody was ready, so the table is empty or gone (PLT-21 deletes it at once): there is no table to go back to, and the game's page is where they go.
 */
export function failedCheck({ sawCheck, began, status, players, unknown }: { sawCheck: boolean; began: boolean; status: GameStatus | null; players: number; unknown: boolean }): "table" | "game" | null {
  if (!sawCheck || began) return null
  if (unknown) return "game"
  if (status !== "lobby") return null
  return players === 0 ? "game" : "table"
}

/** Whole seconds left of the ready check, rounded up so that 0 means the time is up; null outside a check. `readyInMs` is what the server said when `receivedAt` (`performance.now()`) was, `now` is the same clock. */
export function secondsLeft(readyInMs: number | null, receivedAt: number, now: number): number | null {
  if (readyInMs === null) return null
  return Math.max(0, Math.ceil((readyInMs - (now - receivedAt)) / 1000))
}

/** What a board that has not got the table down as ready can show at most: the bar is full only when the table says everybody is. */
export const MAX_WHILE_LOADING = 0.99

/** One seat of the start screen: who sits there, and how far their board is. */
export type LoadingRow = {
  id: string
  name: string
  avatarUrl: string | null
  /** The viewer */
  me: boolean
  /** The table has them down as ready: they pressed the button and their board is loaded */
  ready: boolean
  /** 0 to 1: how far their board is loaded. 1 once the table has them down as ready, never more than `MAX_WHILE_LOADING` before: a board that is loaded is not a player who has said they are there */
  progress: number
}

const clamp = (value: number | undefined) => (typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0)

/**
 * Seat by seat, how far each board is. The table says who is ready (`ready`, the marks it holds: a player who pressed the button and whose board is loaded); how far the others are comes from what their boards report to each other (`reported`, by player
 * id: the presence of the table's loading channel), and the viewer's own board is known here (`own`). A player who pressed before their board was loaded is not listed ready yet, and shows how far their board is. Every seat is listed, in seat order.
 */
export function loadingRows({
  players,
  ready,
  reported,
  meId,
  own,
}: {
  players: readonly (PlayerInfo & { avatarUrl?: string })[]
  ready: readonly string[]
  reported: Readonly<Record<string, number>>
  meId: string | null
  own: number
}): LoadingRow[] {
  const done = new Set(ready)
  return players.map((player) => {
    const isReady = done.has(player.id)
    const me = player.id === meId
    const progress = isReady ? 1 : Math.min(MAX_WHILE_LOADING, clamp(me ? own : reported[player.id]))
    return { id: player.id, name: player.nickname, avatarUrl: player.avatarUrl ?? null, me, ready: isReady, progress }
  })
}

/** The collective bar: the mean of the boards' progress, 0 to 1. Nobody at the table, nothing to show. */
export function collectiveProgress(rows: readonly Pick<LoadingRow, "progress">[]): number {
  return rows.length ? rows.reduce((sum, row) => sum + row.progress, 0) / rows.length : 0
}
