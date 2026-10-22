import type { SeatAvatar } from "./seat-avatar"
import type { SeatTheme } from "./ui-theme"

/**
 * The seat avatar painted on a 2D canvas, for the tables: they draw names as flat textures, so the avatar next to a name is one
 * too. It is the picture of `components/game/seat-label.tsx` (same spec from `seat-avatar.ts`, same theme, same proportions), and the
 * only place that knows how to draw it outside the DOM. Core stays free of three.js: a game wraps the canvas in its own texture.
 */

// Proportions of the avatar, as fractions of its diameter
const MARGIN = 0.1
const RING = 0.045
const SQUARE_RADIUS = 0.24
const INITIAL = 0.5

/** The share of the canvas the avatar fills, the rest is room for its ring and its shadow: a plane that shows the canvas is `diameter / AVATAR_FILL` wide */
export const AVATAR_FILL = 1 - 2 * MARGIN

/** The fallback of a font that resolves to nothing */
export const FALLBACK_FONT = "sans-serif"

const VAR = /var\(\s*(--[\w-]+)\s*(?:,((?:[^()]|\([^()]*\))*))?\)/g

/**
 * Replaces the `var(--name, fallback)` of a CSS value: canvas fonts and colors do not know custom properties. `read` gives the
 * value of one (empty when it is not set), the fallback applies then. A reference that resolves to more references is followed a
 * few times; whatever is left unresolved is dropped.
 */
export function resolveVars(value: string, read: (name: string) => string): string {
  let out = value
  for (let pass = 0; pass < 4 && out.includes("var("); pass++) {
    out = out.replace(VAR, (_, name: string, fallback?: string) => read(name).trim() || fallback?.trim() || "")
  }
  return out.includes("var(") ? "" : out.trim()
}

/** `resolveVars` against the computed style of the page (the game's skin sets its fonts and colors there) */
export function resolveCssVars(value: string): string {
  if (typeof document === "undefined") return resolveVars(value, () => "")
  const style = getComputedStyle(document.documentElement)
  return resolveVars(value, (name) => style.getPropertyValue(name))
}

/** The font-family a theme's `font` stands for on this page, ready for `ctx.font` (no empty entry: a stack with one is not a font) */
export function seatFontFamily(font: string): string {
  const family = resolveCssVars(font)
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .join(", ")
  return family || FALLBACK_FONT
}

/** Where and how big the avatar is drawn inside a canvas of `px` pixels: the centre, the diameter and the ring's width */
export function avatarGeometry(px: number) {
  const diameter = px * AVATAR_FILL
  return { center: px / 2, diameter, ring: diameter * RING, radius: diameter * SQUARE_RADIUS }
}

type Path = Pick<CanvasRenderingContext2D, "beginPath" | "arc" | "moveTo" | "arcTo" | "closePath">

/** The outline of the avatar: a disc, or a square with rounded corners (`radius`), `size` wide, centred on `center` */
function outline(ctx: Path, shape: SeatTheme["shape"], center: number, size: number, radius: number) {
  ctx.beginPath()
  if (shape === "disc") {
    ctx.arc(center, center, size / 2, 0, Math.PI * 2)
  } else {
    const a = center - size / 2
    const b = center + size / 2
    ctx.moveTo(a + radius, a)
    ctx.arcTo(b, a, b, b, radius)
    ctx.arcTo(b, b, a, b, radius)
    ctx.arcTo(a, b, a, a, radius)
    ctx.arcTo(a, a, b, a, radius)
  }
  ctx.closePath()
}

/** `image` scaled to cover a `size` square centred on `center` (what `object-fit: cover` does) */
function drawCover(ctx: CanvasRenderingContext2D, image: CanvasImageSource & { width: number; height: number }, center: number, size: number) {
  const scale = Math.max(size / image.width, size / image.height)
  const w = image.width * scale
  const h = image.height * scale
  ctx.drawImage(image, center - w / 2, center - h / 2, w, h)
}

/**
 * Paints the avatar on a square canvas: the seat colour with the initial in its readable ink, or the account picture, then the
 * ring. `family` is a resolved font-family (`seatFontFamily`), `image` a loaded picture (without it the generated avatar shows).
 */
export function paintSeatAvatar(
  ctx: CanvasRenderingContext2D,
  avatar: SeatAvatar,
  theme: SeatTheme,
  px: number,
  image?: (CanvasImageSource & { width: number; height: number }) | null,
  family: string = FALLBACK_FONT,
) {
  const { center, diameter, ring, radius } = avatarGeometry(px)
  ctx.clearRect(0, 0, px, px)

  // body, with a soft drop shadow like the DOM avatar's
  ctx.save()
  outline(ctx, theme.shape, center, diameter, radius)
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)"
  ctx.shadowBlur = px * 0.04
  ctx.shadowOffsetY = px * 0.012
  ctx.fillStyle = avatar.color
  ctx.fill()
  ctx.restore()

  // picture or initial, clipped to the body
  ctx.save()
  outline(ctx, theme.shape, center, diameter, radius)
  ctx.clip()
  if (image) {
    drawCover(ctx, image, center, diameter)
  } else {
    ctx.fillStyle = avatar.ink
    ctx.font = `900 ${Math.round(diameter * INITIAL)}px ${family}`
    ctx.textAlign = "center"
    ctx.textBaseline = "alphabetic"
    const m = ctx.measureText(avatar.initial)
    ctx.fillText(avatar.initial, center, center + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2)
  }
  ctx.restore()

  // ring, outside the body
  outline(ctx, theme.shape, center, diameter + ring, radius + ring / 2)
  ctx.lineWidth = ring
  ctx.strokeStyle = resolveCssVars(theme.ring) || "rgba(255, 255, 255, 0.45)"
  ctx.stroke()
}

/** A new canvas with the avatar painted on it; `null` outside a browser */
export function seatAvatarCanvas(
  avatar: SeatAvatar,
  theme: SeatTheme,
  px = 256,
  image?: (CanvasImageSource & { width: number; height: number }) | null,
  family?: string,
): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null
  const canvas = document.createElement("canvas")
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  paintSeatAvatar(ctx, avatar, theme, px, image, family)
  return canvas
}
