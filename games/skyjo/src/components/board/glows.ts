import { defineGlows } from "@pbgo/table"

/** What the cards light up with */
export const GLOWS = defineGlows({
  /** The light round a pile on the viewer's turn to draw or take, and round the card in hand */
  pile: { outline: {}, halo: { pulse: 0.25 } },
  /** The ring around the card in the viewer's hand */
  hand: { frame: {} },
})
