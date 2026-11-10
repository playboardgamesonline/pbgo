"use client"

import { createContext, useContext, useState, useSyncExternalStore } from "react"
import { createDragStore, type DragSnapshot, type DragStore, NOT_DRAGGING } from "./store"

/** Carries the zones of the table and the drag that is going on over them. It sits inside the canvas, because React context does not cross into it */
export const DragContext = createContext<DragStore | null>(null)

/** The store of a thing drawn outside a `Table`: nothing there but itself, so it finds no zone */
const ALONE = createDragStore()

/** The zones and the drag of the table this is drawn on. Outside a `Table` a component has a store of its own, which no zone shares */
export function useDragStore(): DragStore {
  const table = useContext(DragContext)
  const [own] = useState(() => (table ? null : createDragStore()))
  return table ?? own ?? ALONE
}

/** What the drag of the table is now: whether something is held, which zones it may be let go on, and which one it is over. A component that draws something for it, such as the rings of a board, re-renders when it changes, which is when the held thing crosses into a zone */
export function useDragState(): DragSnapshot {
  const store = useDragStore()
  return useSyncExternalStore(store.subscribe, store.snapshot, () => NOT_DRAGGING)
}
