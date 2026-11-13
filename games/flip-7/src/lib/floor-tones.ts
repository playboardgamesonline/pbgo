/**
 * The colours of the floor buttons and zones of the board, `#rrggbb`: a blue-green for Hit (and for Deal and for the zones that give a card), and a grey with a hint of the same blue-green for Stay, so that the pair belongs together and reads at a glance.
 * The settings' theme (`background`, `foreground`, `accent`, `surface`, `surfaceDark`) has no slot for them, so they are named here, in one place, and not in the board: to let the owner set them in `/gamemaster/flip-7`, the theme of the settings has to grow two colours.
 */
export const FLOOR_TONES = { hit: "#19a89a", stay: "#7d9899", target: "#19a89a" } as const
