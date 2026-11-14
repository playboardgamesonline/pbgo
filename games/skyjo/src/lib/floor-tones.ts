/**
 * The colours of the floor buttons and zones of the board, `#rrggbb`: a blue to draw from the pile (and to deal), an amber to take the discard, a grey to throw the drawn card away and a pale blue for the cells of the viewer's grid. The cards bring the colour to the
 * table (green, yellow, red, blue), so the pads keep to a few quiet tones that none of the card colours is. The settings' theme (`background`, `foreground`, `accent`, `surface`, `surfaceDark`) has no slot for them, so they are named here, in one place, and not in
 * the board: to let the owner set them in `/gamemaster/skyjo`, the theme of the settings has to grow slots for them.
 */
export const FLOOR_TONES = { draw: "#4a8fe0", take: "#d9a03c", throwAway: "#8d93a0", deal: "#4a8fe0", cell: "#9fd8ee" } as const
