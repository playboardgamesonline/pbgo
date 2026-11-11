import { defineGlows } from "@pbgo/table"

/** What the cards light up with */
export const GLOWS = defineGlows({
  /** The ring around a face-up card the viewer is about to give */
  selection: { frame: {} },
  /** The light round the draw pile on the viewer's turn to hit */
  deck: { outline: {}, halo: { pulse: 0.25 } },
})
