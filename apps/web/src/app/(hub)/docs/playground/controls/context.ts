import type { PlayActions, PlayState } from "../../_specimens/scene/defaults"

/** What the panels of the controls work with: the table's state, the ways to change it (each is one entry of the undo stack) and what the scene tells them */
export type Controls = {
  state: PlayState
  /** Changes some fields */
  set: (patch: Partial<PlayState>) => void
  /** Changes the state with a pure function of it: the transitions of `play/state.ts` are these */
  update: (change: (now: PlayState) => PlayState) => void
  actions: PlayActions
  /** The table is full of things */
  full: boolean
}
