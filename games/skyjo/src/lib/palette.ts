/**
 * Skyjo's own colours, read off its printed identity (the card back of `materiel.pdf` and the booklet's header): the back is a conic rainbow laid over a cracked-glass mosaic, with white lettering outlined in blue, and the booklet is printed on a bright azure.
 * The table is the dark end of that rainbow, a deep indigo felt, with a faint rainbow pool of light in the middle; the cards, which carry the full colours, stay the brightest things on it. The theme's own colours (`SETTINGS_DEFAULTS`) say indigo; these are
 * the parts of the look the settings' theme has no slot for: the hues of the glow and the mosaic's strength. Nothing else of the game holds a colour.
 */

/** The hues of the rainbow of the card back, round the circle from the pink at the top left: the faint glow in the middle of the table goes through them */
export const RAINBOW = ["#ff4f9a", "#ff9a3d", "#f5e84a", "#5ed06b", "#33c4dc", "#4f7cf5", "#9a58ef", "#ff4f9a"] as const

/** How strong the rainbow glow is where it is brightest (0 to 1): low, so that the cards stay the brightest colours of the table */
export const GLOW_STRENGTH = 0.14

/** The cracked-glass mosaic of the felt: how many cells across one repeat of the texture, how much a cell's shade varies and how bright its cracks are, as shares of the felt (low: it is a texture, not a pattern) */
export const MOSAIC = { cells: 9, shade: 0.05, crack: 0.06, grain: 0.05 }
