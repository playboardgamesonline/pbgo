import { defineGlows } from "@pbgo/table"

/**
 * What the cards light up with. The colours are the settings' (`lightGlows` gives them the `accent` when the table draws), so the board holds no colour of its own: the parts the glows are made of are read on every frame and the debug panel edits them the
 * same way.
 */
export const GLOWS = defineGlows({
  /** The ring around the card of the viewer's hand that is picked */
  selection: { frame: {} },
  /** The halo round a Handmaid that protects its player until their next turn */
  shielded: { halo: { opacity: 0.5, spread: 0.2 } },
})

/** Gives every glow the colour of the game's accent */
export function lightGlows(color: string) {
  for (const glow of Object.values(GLOWS)) {
    if (glow.frame) glow.frame.color = color
    if (glow.halo) glow.halo.color = color
  }
}
