import type { CharacterKey } from "@love-letter/engine"
import { useSyncExternalStore } from "react"

/**
 * The card the player is reading: held up large over the middle of the screen (`Lens` of `components/game`), since the text of a face is about 4 % of its width tall and cannot be read at the size a card has on the table. The board tells the store which card the pointer is on (and which
 * card is picked, for a screen that cannot hover), and the lens draws it: a store of its own, so that the pointer crossing the cards never draws the whole board again. No three.js in here: the face is the canvas the table painted it on.
 */
export type LensCard = { id: number; type: CharacterKey; source: HTMLCanvasElement }

type State = { hovered: LensCard | null; picked: LensCard | null }

let state: State = { hovered: null, picked: null }
const listeners = new Set<() => void>()

function set(next: Partial<State>) {
  if ((next.hovered === undefined || next.hovered === state.hovered) && (next.picked === undefined || next.picked === state.picked)) return
  state = { ...state, ...next }
  for (const listener of listeners) listener()
}

/** The card under the pointer */
export const holdHovered = (card: LensCard) => set({ hovered: card })

/** The pointer left the card `id`: it is no longer held up, unless the pointer is already on another one (the events of a move from a card to the next may come in either order) */
export const releaseHovered = (id: number) => {
  if (state.hovered?.id === id) set({ hovered: null })
}

/** The card the viewer picked, or none: held up on a screen that cannot hover */
export const holdPicked = (card: LensCard | null) => set({ picked: card })

/** The card held up is no longer on the table (a card that is played, a choice that goes, a reveal that ends does not get a pointer-out event when it goes): let it go, unless it is one of the cards `ids` that are */
export const releaseHoveredUnless = (ids: ReadonlySet<number>) => {
  if (state.hovered && !ids.has(state.hovered.id)) set({ hovered: null })
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const useLens = (): State => useSyncExternalStore(subscribe, () => state, () => state)
