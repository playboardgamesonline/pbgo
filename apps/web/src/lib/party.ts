import { useSyncExternalStore } from "react"
import { createApi } from "@pbgo/core/lib/api"
import { PARTY_PATH, partyAnswerOf, partyEnded, type PartyTable } from "@pbgo/core/lib/party"

// The table that the leader of the visitor's group opened for it (PLT-141), as the browser knows it: the one place that holds it, read by the play zone of the home, which shows the leader's wait, and by `PartySync`, which asks the server for it, sits the member down at it by itself and takes
// everybody to its board when it begins. The server is the only state: the table is read again every few seconds while the member is in a group (`PartySync`), so a reload, a second tab or a member who comes late all see what the others see, and nothing is kept in the browser.
// The leader's own press sets it at once (`setParty`), before the first read. Client side only: the server renders nobody at a party.

let table: PartyTable | null = null
/** When the table was last read from the server, to tell two reads that follow one another from a tab that was away. */
let readAt = 0
/** Whether a read is on its way: another is not sent meanwhile. */
let reading = false
const listeners = new Set<() => void>()
const endedListeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Keeps a table, and tells whoever shows it: a read that says what the page has already changes nothing. */
export function setParty(next: PartyTable | null) {
  if (JSON.stringify(next) === JSON.stringify(table)) return
  table = next
  for (const listener of listeners) listener()
}

/** Calls `listener` when the table that the member sat at is gone from one read to the next (its leader cancelled it). Returns what stops it. */
export function onPartyEnded(listener: () => void): () => void {
  endedListeners.add(listener)
  return () => endedListeners.delete(listener)
}

/** Asks the server for the table of the visitor's group and keeps the answer. A call that fails (the network, a server that is busy) changes nothing: the next one tries again. */
export async function readParty(): Promise<void> {
  if (reading) return
  reading = true
  try {
    const response = await fetch(PARTY_PATH, { cache: "no-store" })
    if (!response.ok) return
    const next = partyAnswerOf(await response.json().catch(() => null))
    const now = Date.now()
    const ended = partyEnded(table, next, now - readAt)
    readAt = now
    setParty(next)
    if (ended) for (const listener of endedListeners) listener()
  } catch {
    // The network: the next read tries again
  } finally {
    reading = false
  }
}

/** The table of the visitor's group, read now (not a hook): null until the server has said there is one. */
export function usePartyTable(): PartyTable | null {
  return useSyncExternalStore(
    subscribe,
    () => table,
    () => null,
  )
}

/** The leader gives the table up: they leave it, which takes the seats of the group with it (`leavePatch`), and the members' tabs find it gone. Throws what the server refuses with. */
export async function cancelParty(): Promise<void> {
  const current = table
  if (!current) return
  await createApi(current.game).leave(current.code)
  setParty(null)
}

/** The leader starts with the people who came: the host's own start, which puts the table in its ready check. Throws what the server refuses with. */
export async function startParty(): Promise<void> {
  const current = table
  if (!current) return
  await createApi(current.game).start(current.code)
  await readParty()
}
