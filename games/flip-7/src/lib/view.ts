import type { PlayerView, PublicPhase } from "@flip-7/engine"

/**
 * The engine's view as the shared UI reads it: `phase` is the name of the step (`"over"` ends the game, as in every game) and `me`
 * is `{ id }`. `step` keeps the whole phase (who plays, which card is to be given, to whom).
 */
export type TableView = Omit<PlayerView, "phase" | "me"> & { phase: PublicPhase["kind"]; step: PublicPhase; me: { id: string } | null }

export const tableView = (view: PlayerView): TableView => ({
  ...view,
  phase: view.phase.kind,
  step: view.phase,
  me: view.me === null ? null : { id: view.me },
})
