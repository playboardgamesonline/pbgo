import { useSyncExternalStore } from "react"
import { ApiClientError, gameRequest } from "@pbgo/core/lib/api"
import { PLAY_CANCEL_PATH, PLAY_PATH, type PlayState } from "@pbgo/core/lib/quick-play"
import { parseQueue, queueSeconds, type Queue, type QueueGame, type QueueMode, type QueueTable } from "@pbgo/ui/queue"

// The search of the visitor who looks for a table: the one place that knows it, read by the buttons that start a search (a game's page, the signed-in home), by the social panel, which shows the same wait, and by `SearchSync`, which keeps it alive. A search is real
// (PLT-21): pressing Play sits the visitor at a table of each game they picked, a public lobby that waits or one they open, with `POST /api/hub/play` (`server/quick-play.ts`), and the table that fills first begins by itself. The browser asks again every few seconds while
// the search lasts (`pollSearch`), which keeps the visitor's seats alive and says where the tables are; the table that has begun takes the visitor to its board (`SearchSync`), and stopping the search leaves the tables (`POST /api/hub/play/cancel`).
// The search is kept in this module for as long as the page lives, which the hub's pages share (a visitor who goes from one to another keeps it), and in the browser's session storage, so that a reload does not forget it (`parseQueue` reads it back and drops what is too
// old). A visitor looks for tables through one search at a time, of one game or of several, ranked or normal: starting another stops the first. Client side only: the server renders nobody in a queue.

const KEY = "pbgo:queue"

/** What the module holds: `undefined` until the browser has been read. */
let queue: Queue | null | undefined
const listeners = new Set<() => void>()
/** The nickname a guest sits down under, kept in this module only: it is on the device already, under the key of the game (`useProfileOf`). */
let nickname: string | undefined
/** Whether the press that began the search, or a call that keeps it alive, is on its way: another is not sent meanwhile, so that the server never has two at once for one visitor. */
let calling = false
/** Whether a press is on its way: a second press (a double click) is not heard, since it would stop the search the first one is making. */
let pressing = false

function read(): Queue | null {
  try {
    const raw = window.sessionStorage.getItem(KEY)
    return raw === null ? null : parseQueue(JSON.parse(raw), Date.now())
  } catch {
    // Storage that is blocked, or text that is not JSON: no queue
    return null
  }
}

function keep(next: Queue | null) {
  queue = next
  try {
    if (next) window.sessionStorage.setItem(KEY, JSON.stringify(next))
    else window.sessionStorage.removeItem(KEY)
  } catch {
    // Without storage the queue lives as long as the page does
  }
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const snapshot = (): Queue | null => (queue === undefined ? (queue = read()) : queue)
const server = (): Queue | null => null

/** The search the visitor is on, read now (not a hook): for the code that runs after a delay. */
export const currentQueue = (): Queue | null => snapshot()

const post = <T>(path: string, body: unknown) => gameRequest<T>(path, { method: "POST", body: JSON.stringify(body) })

const tablesOf = (state: PlayState): QueueTable[] => state.tables.map(({ game, code, status, players, seats }) => ({ game, code, status, players, seats }))

/** What every call of the search says: the games, the kind of table and, for a guest, the nickname they sit down under. */
const bodyOf = (current: Queue, extra: Record<string, unknown>) => ({ games: current.games.map((game) => game.slug), mode: current.mode, ...(nickname ? { nickname } : {}), ...extra })

const leftListeners = new Set<() => void>()

/** Calls `listener` each time the server has answered that the visitor left the tables of a search: what a page lists of the tables is then out of date. Returns what stops it. */
export function onTablesLeft(listener: () => void): () => void {
  leftListeners.add(listener)
  return () => leftListeners.delete(listener)
}

/** The visitor leaves tables of a search, which the server unseats them from. Never fails: a table that is left in the end is dead in minutes, and the visitor has gone on. Settles when the server has answered. */
function leaveTables(tables: readonly { game: string; code: string }[], current: Pick<Queue, "mode" | "since">): Promise<void> {
  if (tables.length === 0) return Promise.resolve()
  return post(PLAY_CANCEL_PATH, { tables: tables.map(({ game, code }) => ({ game, code })), mode: current.mode, waited: queueSeconds(current, Date.now()) }).then(
    () => undefined,
    () => undefined,
  ).then(() => {
    for (const listener of leftListeners) listener()
  })
}

/**
 * The visitor presses Play: from now, and in place of the search they had (which is stopped), they look for a table of these games (one at least), ranked or normal. The server sits them down at one table for each game and the answer is kept; a refusal (a guest who
 * asks for a ranked table, a game for adults, too many requests) stops the search and is thrown for the caller to tell. `who.nickname` is the name a guest sits down under: a member sits down as their account.
 */
export async function startSearch(games: readonly QueueGame[], mode: QueueMode, who: { nickname?: string } = {}): Promise<void> {
  if (games.length === 0 || pressing) return
  pressing = true
  try {
    // The tables of the search they had are left first: the new one may sit them at the same ones, and must not meet the leave
    await leaveQueue()
    nickname = who.nickname
    const next: Queue = { games: games.map(({ slug, name }) => ({ slug, name })), mode, since: Date.now() }
    keep(next)
    calling = true
    try {
      const state = await post<PlayState>(PLAY_PATH, bodyOf(next, {}))
      // The visitor stopped it, or began another, while the server was answering: the tables it sat them at are left
      if (queue?.since !== next.since) await leaveTables(state.tables, next)
      else keep({ ...next, tables: tablesOf(state) })
    } catch (error) {
      if (queue?.since === next.since) keep(null)
      throw error
    } finally {
      calling = false
    }
  } finally {
    pressing = false
  }
}

/** What the server answered that does not end a search: it was too busy, or could not be reached. The next call tries again. */
const TRANSIENT = new Set(["RATE_LIMITED", "SERVER_ERROR", "CONFLICT"])

/**
 * Asks the server where the search is, which also keeps the visitor's seats alive (a lobby is listed while somebody who sits at it was seen lately) and sits them down again where a table went. Called every few seconds while a search lasts. What it answers is kept. A refusal that
 * a new try will not change (the account was signed out, the game is gone) stops the search and is thrown.
 */
export async function pollSearch(): Promise<void> {
  const current = snapshot()
  if (!current || calling) return
  calling = true
  try {
    const state = await post<PlayState>(PLAY_PATH, bodyOf(current, { poll: true, waited: queueSeconds(current, Date.now()) }))
    const now = snapshot()
    if (now?.since !== current.since) await leaveTables(state.tables, current)
    else if (JSON.stringify(now.tables ?? []) !== JSON.stringify(tablesOf(state))) keep({ ...now, tables: tablesOf(state) })
  } catch (error) {
    // A network that fails, or a server that is busy: the search goes on and asks again
    if (!(error instanceof ApiClientError) || TRANSIENT.has(error.code)) return
    if (snapshot()?.since === current.since) keep(null)
    throw error
  } finally {
    calling = false
  }
}

/** The visitor stops looking: nothing is kept, and the tables of the search are left. Settles when the server has answered. */
export function leaveQueue(): Promise<void> {
  const current = snapshot()
  if (!current) return Promise.resolve()
  keep(null)
  return leaveTables(current.tables ?? [], current)
}

/** The search is over because a table of it has begun: nothing is kept, and nothing is left, since the server unseats the players of a game that begins from the other tables where they sit. */
export function dropQueue() {
  if (snapshot()) keep(null)
}

/** The queue the visitor is in, if any. Nobody is in one while the page is rendered by the server: it is read in the browser, after it has hydrated. */
export function useQueue(): Queue | null {
  return useSyncExternalStore(subscribe, snapshot, server)
}

const everySecond = (listener: () => void) => {
  const timer = setInterval(listener, 1000)
  return () => clearInterval(timer)
}
const never = () => () => {}

/**
 * How long that queue has lasted, in whole seconds, counted again every second while there is one: nothing ticks without a queue. The clock starts when the counter is drawn, which is when the visitor pressed
 * the button, so each tick falls on a new second of the wait.
 */
export function useQueueSeconds(waiting: Queue | null): number {
  return useSyncExternalStore(
    waiting ? everySecond : never,
    () => (waiting ? queueSeconds(waiting, Date.now()) : 0),
    () => 0,
  )
}
