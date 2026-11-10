import { areaOf, contains, type DropShape } from "./shapes"

/** What names a zone a thing can be let go on: the game's own id for it, a word or a number. A cell of a board is its number */
export type ZoneId = string | number

/** What a drag is, at this moment, for whoever draws it: whether something is held, the zones it may be let go on (null when it may go on any), and the zone it is over */
export type DragSnapshot = { dragging: boolean; legal: readonly ZoneId[] | null; over: ZoneId | null }

/** The registry of the zones of one table, and the drag that is going on over them: one thing is dragged at a time */
export type DragStore = {
  /** Puts a zone on the table. Returns what takes it off. Two zones with one id are one zone with two shapes */
  register(id: ZoneId, shape: DropShape): () => void
  /** How many shapes are on the table */
  count(): number
  /** The zone that holds the point (x, z), among the `legal` ones when they are given: the smallest of the zones that hold it, the last one registered when they are as small as each other. Null when none does */
  zoneAt(x: number, z: number, legal?: readonly ZoneId[] | null): ZoneId | null
  /** Starts a drag that may be let go on the `legal` zones, or on any when it is null. False, and nothing starts, when a drag is going on already */
  begin(legal: readonly ZoneId[] | null): boolean
  /** The thing held is over (x, z): works out the zone it is over. Returns it */
  move(x: number, z: number): ZoneId | null
  /** Ends the drag, however it ended */
  end(): void
  /** What a drag is now. The same object until something changes, so a component can read it with `useSyncExternalStore` */
  snapshot(): DragSnapshot
  /** Calls `listener` whenever the snapshot changes. Returns what stops it */
  subscribe(listener: () => void): () => void
}

/** What a drag is when nothing is held */
export const NOT_DRAGGING: DragSnapshot = { dragging: false, legal: null, over: null }

/** A store for one table. The `Table` makes one and every drag and zone inside it finds it, so two tables on a page never see each other's zones */
export function createDragStore(): DragStore {
  type Entry = { id: ZoneId; shape: DropShape; area: number }
  const entries = new Set<Entry>()
  const listeners = new Set<() => void>()
  let current: DragSnapshot = NOT_DRAGGING

  const change = (next: DragSnapshot) => {
    current = next
    listeners.forEach((listener) => listener())
  }

  const zoneAt: DragStore["zoneAt"] = (x, z, legal = null) => {
    let best: Entry | null = null
    for (const entry of entries) {
      if (legal && !legal.includes(entry.id)) continue
      if (!contains(entry.shape, x, z)) continue
      // The smaller zone is the one asked for when one lies on another; the later of two as small is the one drawn over
      if (!best || entry.area <= best.area) best = entry
    }
    return best ? best.id : null
  }

  return {
    register(id, shape) {
      const entry: Entry = { id, shape, area: areaOf(shape) }
      entries.add(entry)
      return () => {
        entries.delete(entry)
      }
    },
    count: () => entries.size,
    zoneAt,
    begin(legal) {
      if (current.dragging) return false
      change({ dragging: true, legal, over: null })
      return true
    },
    move(x, z) {
      if (!current.dragging) return null
      const over = zoneAt(x, z, current.legal)
      if (over !== current.over) change({ ...current, over })
      return over
    },
    end() {
      if (current.dragging) change(NOT_DRAGGING)
    },
    snapshot: () => current,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
