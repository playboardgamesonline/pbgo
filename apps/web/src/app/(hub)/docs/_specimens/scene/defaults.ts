// What the light half of a specimen (its controls) and the heavy half (its scene) both need to know. Plain numbers only: this file imports nothing, so the controls can read it without pulling in three.js.

/** The view the camera specimen starts from, and its reset returns to. The scene adds the point it looks at. */
export const CAMERA_VIEW = { tilt: 40, yaw: 0, distance: 15, fov: 34 }
export type CameraView = typeof CAMERA_VIEW

/** The cards of the viewer's hand on the small board, by the number of their face (`face` of the art). */
export const BOARD_HAND: readonly number[] = [2, 7, 12, 17, 22, 27]

/** The players a small board seats. */
export const BOARD_PLAYERS = [2, 3, 4, 5] as const

/** How dark the card specimen's shadow starts. The package's own default is a hair, and the shadow itself is a soft edge a few percent dark at the most, so the slider starts at its top, where the switch can just be seen to do something. */
export const SHADOW_START = 1

/** The cards of the pose-memory specimen: they start in the hand. */
export const MEMORY_CARDS: readonly number[] = [4, 9, 14, 19, 24]

/** The most cards the layouts specimen lays, and how many it starts with. */
export const LAYOUT_CARDS = { max: 12, start: 7 }

/** The layouts the toggle offers, in the order of the page. */
export const LAYOUTS = ["fan", "row", "pile", "grid"] as const
export type LayoutName = (typeof LAYOUTS)[number]

/** The pile specimen: the most cards the slider reaches, the count it starts at and the cards drawn from it. */
export const PILE_CARDS = { max: 30, start: 14 }

/** The players the seats specimen rings, from two to eight. */
export const SEAT_PLAYERS = { min: 2, max: 8, start: 4 }

/** A card drawn from the pile: its number, and how many cards the draw pile held when it was taken (that is where it left from). */
export type Drawn = { id: number; from: number }

/** The three fields of `CARD_SETTINGS` the flight specimen puts in the visitor's hands. */
export type FlightKnobs = { flightDuration: number; flightHeight: number; foldable: number }
