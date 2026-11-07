import { useSyncExternalStore } from "react"
import { parseQueue, queueSeconds, type Queue, type QueueGame, type QueueMode } from "@pbgo/ui/queue"

// The queue of the visitor who looks for a game: the one place that knows it, read by the buttons that start a search (a game's page, the signed-in home) and by the social panel, which show the same wait. It is kept in this module for as long as the page lives, which the
// hub's pages share (a visitor who goes from one to another keeps it), and in the browser's session storage, so that a reload does not forget it (`parseQueue` reads it back, and drops what is too old). A visitor looks for tables through one
// search at a time, of one game or of several, ranked or normal: starting another replaces the first. There is nothing behind it yet: no table is found for them, so the counter runs until they stop it. The day the platform matches players (PLT-13's tables),
// `joinQueue` and `leaveQueue` are what ask it, and the rest does not change. Client side only: the server renders nobody in a queue.

const KEY = "pbgo:queue"

/** What the module holds: `undefined` until the browser has been read. */
let queue: Queue | null | undefined
const listeners = new Set<() => void>()

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

/** The visitor starts looking for a table of these games (one at least), ranked or normal: from now, and in place of the search they had. */
export function joinQueue(games: readonly QueueGame[], mode: QueueMode) {
  if (games.length === 0) return
  keep({ games: games.map(({ slug, name }) => ({ slug, name })), mode, since: Date.now() })
}

/** The visitor stops looking. */
export function leaveQueue() {
  keep(null)
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
