import type { PlayerInfo } from "@pbgo/engine-kit"
import type { GameStatus } from "./game-types"

/**
 * The start screen (PLT-107) is the platform's, over the board of a table: the board is drawn behind it and loads, each player is ready when their board is, and the screen goes away, for everybody at once, when the last one is. This is its
 * logic, pure and tested; `BoardEntry` and `StartScreen` draw it.
 */

/** How long a board is waited for to say it is loaded (`BoardProps.onLoaded`) before its player counts as ready anyway: a slow line, or a board that does not report, is not a reason to hold the others or to be unseated. */
export const READY_LOAD_GRACE_MS = 20_000

/**
 * - `loading`: the player's board is not loaded and the table has not got them down as ready
 * - `waiting`: it is (or the table knows it), and the game waits for the others
 * - `lifted`: the screen is gone, the board plays
 */
export type CurtainState = "loading" | "waiting" | "lifted"

/**
 * Where the start screen stands. `marked`: the table has the player down as ready. `loaded`: their board said so, or the grace is over.
 * - A table in its ready check keeps the screen up for everybody until the game begins, whoever is ready and whoever is not.
 * - A game under way (the player came back to it) has no barrier: the screen goes as soon as their own board is there.
 * - A game that is over shows its end with no screen.
 */
export function curtainState({ status, marked, loaded }: { status: GameStatus; marked: boolean; loaded: boolean }): CurtainState {
  if (status === "over") return "lifted"
  if (status === "playing") return loaded ? "lifted" : "loading"
  return marked || loaded ? "waiting" : "loading"
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
  /** The table has them down as ready */
  ready: boolean
  /** 0 to 1: how far their board is loaded. 1 once the table has them down as ready, never more than `MAX_WHILE_LOADING` before */
  progress: number
}

const clamp = (value: number | undefined) => (typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0)

/**
 * Seat by seat, how far each board is. The table says who is ready (`ready`, the marks it holds); how far the others are comes from what their boards report to each other (`reported`, by player id: the presence of the table's
 * loading channel), and the viewer's own board is known here (`own`). Every seat is listed, in seat order.
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
