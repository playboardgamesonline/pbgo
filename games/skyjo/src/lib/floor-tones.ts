/**
 * The colours of the floor buttons and zones of the board, `#rrggbb`, kept to a few tones that sit on the indigo felt and are none of the card colours (green, yellow, red, dark blue): the booklet's azure to draw (and to deal), an amber to take the discard, a
 * lilac grey to throw the drawn card away and a pale lilac for the cells of the viewer's grid. The settings' theme (`background`, `foreground`, `accent`, `surface`, `surfaceDark`) has no slot for them, so they are named here, in one place, and not in the board: to let
 * the owner set them in `/gamemaster/skyjo`, the theme of the settings has to grow slots for them.
 */
export const FLOOR_TONES = { draw: "#4aa8f0", take: "#f0b04a", throwAway: "#a79fc4", deal: "#4aa8f0", cell: "#cdbdff" } as const
