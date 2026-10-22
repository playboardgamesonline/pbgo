/** A soft light behind the card */
export type Halo = {
  color: string
  /** Opacity at rest */
  opacity: number
  /** How far the opacity swings around that, each way */
  pulse: number
  /** Speed of the swing, in radians per second */
  speed: number
  /** How far the light reaches past the card, as a fraction of its smaller side */
  spread: number
  /** "add" brightens what is behind (a glow), "normal" paints over it (a stain) */
  blend: "add" | "normal"
}

/** A solid line around the back of the card */
export type Outline = { color: string; visible: boolean }

/** A ring around the front of the card that breathes: it swells and its opacity swings */
export type Frame = { color: string; opacity: number; pulse: number; breath: number; speed: number }

/** A band of shine with sparks that sweeps over the front */
export type Sparkle = { opacity: number; speed: number }

/** A glow is the parts a card lights up with. A part a glow leaves out is not drawn at all */
export type Glow = { halo?: Halo; outline?: Outline; frame?: Frame; sparkle?: Sparkle }

/** What a game writes: each part only says what differs from the defaults */
export type GlowSpec = { [Part in keyof Glow]?: Partial<NonNullable<Glow[Part]>> }

const HALO: Halo = { color: "#ffffff", opacity: 0.35, pulse: 0.03, speed: 1.6, spread: 0.28, blend: "add" }
const OUTLINE: Outline = { color: "#ffffff", visible: true }
const FRAME: Frame = { color: "#ffffff", opacity: 0.75, pulse: 0.2, breath: 0.012, speed: 3 }
const SPARKLE: Sparkle = { opacity: 0.55, speed: 0.35 }

/**
 * The glows a game gives its cards, by name: `defineGlows({ selection: { frame: {} }, gold: { halo: { color: "#f2c14e", spread: 0.14 }, sparkle: {} } })`.
 * Every glow gets its own parts, filled in with the defaults.
 * A card reads the colours, opacities and speeds on every frame, so a debug panel can tune them while the game runs; `spread` and `blend` are read when the card is drawn.
 */
export function defineGlows<Name extends string>(specs: Record<Name, GlowSpec>) {
  const glows = {} as Record<Name, Glow>
  for (const [name, spec] of Object.entries<GlowSpec>(specs)) {
    const glow: Glow = {}
    if (spec.halo) glow.halo = { ...HALO, ...spec.halo }
    if (spec.outline) glow.outline = { ...OUTLINE, ...spec.outline }
    if (spec.frame) glow.frame = { ...FRAME, ...spec.frame }
    if (spec.sparkle) glow.sparkle = { ...SPARKLE, ...spec.sparkle }
    glows[name as Name] = glow
  }
  return glows
}
