/**
 * The colours of the floor buttons and zones of the board, `#rrggbb`: a luminous blue-green for Hit (and for Deal), a pale cool grey with a hint of the same blue-green for Stay, and a paler aqua for the zones that give a card: all three read against the teal table, so that the pair belongs together and reads at a glance.
 * The settings' theme (`background`, `foreground`, `accent`, `surface`, `surfaceDark`) has no slot for them, so they are named here, in one place, and not in the board: to let the owner set them in `/gamemaster/flip-7`, the theme of the settings has to grow two colours.
 */
export const FLOOR_TONES = { hit: "#4fe0c0", stay: "#b4c6d8", target: "#a6efe0" } as const
