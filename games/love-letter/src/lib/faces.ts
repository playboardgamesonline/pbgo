import type { CharacterKey } from "@love-letter/engine"
import { useSyncExternalStore } from "react"

/**
 * The faces the table painted, for the parts of the screen that are page elements and not the table (the row of the characters a Guard names, `GuessBar`): the board tells the store the canvas of each character once its faces are painted, and the row draws
 * them again at the size of the page, lettering and all. No three.js in here, so that the screen around the table carries none.
 */
export type FaceSources = Partial<Record<CharacterKey, HTMLCanvasElement>>

let sources: FaceSources = {}
const listeners = new Set<() => void>()

/** The canvases of the faces, by character: told again only when one of them is another canvas */
export function publishFaces(next: FaceSources) {
  const keys = new Set([...Object.keys(sources), ...Object.keys(next)]) as Set<CharacterKey>
  if ([...keys].every((key) => sources[key] === next[key])) return
  sources = next
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const useFaceSources = (): FaceSources => useSyncExternalStore(subscribe, () => sources, () => sources)
