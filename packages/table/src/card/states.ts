import type { Field } from "../debug/settings"

/**
 * How a card stands for the player. The game says `base`, `interactive` (can be chosen now), `selected` (picked), `disabled` (cannot be chosen now, though others can) or `out` (its player is out of the round); the table raises an
 * `interactive` card to `hover` and `pressed` by itself, from the pointer and the keyboard, and draws each state's bloom of light and lift. A game may also say `hover` or `pressed`, for a card whose whole zone the pointer is over.
 */
export const CARD_STATES = ["base", "interactive", "hover", "pressed", "selected", "disabled", "out"] as const
export type CardState = (typeof CARD_STATES)[number]

/** What the visitor does to a card now: the pointer is over it, the keyboard focus is on it, the pointer is down on it */
export type Touch = { hovered: boolean; focused: boolean; pressed: boolean }

/** Nothing: the pointer is elsewhere and the keyboard is not there */
export const NO_TOUCH: Touch = { hovered: false, focused: false, pressed: false }

/** The state a card is drawn in: what the game says, raised by what the visitor does to it. A card that is not chosen, or is disabled or out, ignores the visitor; a picked one stays picked under the pointer and only dips while it is pressed */
export function effectiveState(state: CardState, touch: Touch): CardState {
  if (state === "base" || state === "disabled" || state === "out") return state
  if (touch.pressed) return "pressed"
  if (state === "selected" || state === "pressed") return state
  return touch.hovered || touch.focused ? "hover" : state
}

/** Whether a card the game says is in this state can be pressed: it is chosen, picked, or about to be. Everything else lets the pointer by */
export const isPressable = (state: CardState) => state === "interactive" || state === "hover" || state === "pressed" || state === "selected"

/**
 * What the table does for each state, read on every frame so the debug panel tunes it live. The bloom is a number from 0 to 1, how far it is lit, and the colour and the strength it is multiplied by come from the game's `UI_THEME.card`.
 * A lift is a fraction of the card's height, a scale a multiplier.
 */
export const CARD_STATE_SETTINGS = {
  /** Bloom of a card that can be chosen now */
  interactiveBloom: 0.5,
  /** Under the pointer or the keyboard focus: bloom, how far the card lifts and how much it grows */
  hoverBloom: 0.7,
  hoverLift: 0.1,
  hoverScale: 1.04,
  /** While the pointer is down on it: the brightest bloom, and the card goes back down and shrinks a little, as a button does */
  pressedBloom: 1,
  pressedScale: 0.98,
  /** Picked: a steady bloom, the card raised and grown */
  selectedBloom: 0.8,
  selectedLift: 0.25,
  selectedScale: 1.1,
  /** How dark a card that cannot be chosen is, 0 to 1 */
  disabledDim: 0.33,
  /** How far the bloom reaches past the card, as a share of its smaller side */
  bloomSpread: 0.28,
  /** How bright the bloom is at a bloom of 1: it is a light added to the table, not a coat of paint */
  bloomOpacity: 0.75,
  /** How far a card that can be chosen breathes, as a share of its bloom, and how fast */
  bloomPulse: 0.12,
  bloomSpeed: 1.6,
  /** Seconds the bloom takes to settle on a new state */
  bloomSettle: 0.12,
}

/** The knobs a debug panel offers for `CARD_STATE_SETTINGS`: every one is read on a frame but `bloomSpread`, which is read when a card is drawn */
export const CARD_STATE_FIELDS = {
  interactiveBloom: ["can be chosen: bloom", 0, 1, 0.01],
  hoverBloom: ["hover: bloom", 0, 1, 0.01],
  hoverLift: ["hover: lift", 0, 0.6, 0.01],
  hoverScale: ["hover: scale", 0.8, 1.4, 0.01],
  pressedBloom: ["pressed: bloom", 0, 1, 0.01],
  pressedScale: ["pressed: scale", 0.8, 1.4, 0.01],
  selectedBloom: ["picked: bloom", 0, 1, 0.01],
  selectedLift: ["picked: lift", 0, 0.8, 0.01],
  selectedScale: ["picked: scale", 0.8, 1.4, 0.01],
  disabledDim: ["disabled: dim", 0, 0.8, 0.01],
  bloomSpread: ["bloom reach", 0.05, 0.6, 0.01],
  bloomOpacity: ["bloom brightness", 0, 1, 0.01],
  bloomPulse: ["bloom breath", 0, 0.5, 0.01],
  bloomSpeed: ["bloom breath speed", 0, 6, 0.05],
  bloomSettle: ["bloom settle (s)", 0.01, 0.6, 0.01],
} satisfies Record<keyof typeof CARD_STATE_SETTINGS, Field>

/** The key of `UI_THEME.card` that colours a state's bloom, for the states that have one */
export type BloomKey = "interactive" | "hover" | "pressed" | "selected"

/** What a state does to a card at one moment: how lit its bloom is, how far it lifts (a fraction of its height), how much it grows, how dark it is, and which entry of the game's theme colours it */
export type StateLook = { bloom: number; lift: number; scale: number; dim: number; theme: BloomKey | null }

export function stateLook(state: CardState, S: typeof CARD_STATE_SETTINGS = CARD_STATE_SETTINGS): StateLook {
  switch (state) {
    case "interactive":
      return { bloom: S.interactiveBloom, lift: 0, scale: 1, dim: 0, theme: "interactive" }
    case "hover":
      return { bloom: S.hoverBloom, lift: S.hoverLift, scale: S.hoverScale, dim: 0, theme: "hover" }
    case "pressed":
      return { bloom: S.pressedBloom, lift: 0, scale: S.pressedScale, dim: 0, theme: "pressed" }
    case "selected":
      return { bloom: S.selectedBloom, lift: S.selectedLift, scale: S.selectedScale, dim: 0, theme: "selected" }
    case "disabled":
      return { bloom: 0, lift: 0, scale: 1, dim: S.disabledDim, theme: null }
    // `base` lies as it is, and `out` is the grey of the card's own picture
    default:
      return { bloom: 0, lift: 0, scale: 1, dim: 0, theme: null }
  }
}

type Vec = { x: number; y: number; z: number }

/**
 * Which side of a card its bloom lies on: behind it, away from the camera, so the light reaches out round the card whichever way the card faces. A card that faces the camera (face up, or standing up to it) has it on its back; one whose back faces the camera,
 * a pile lying face down, has it on its front. `normal` is the way the front looks, `toCamera` the vector from the card to the camera.
 */
export function haloSide(normal: Vec, toCamera: Vec): "back" | "front" {
  return normal.x * toCamera.x + normal.y * toCamera.y + normal.z * toCamera.z >= 0 ? "back" : "front"
}
