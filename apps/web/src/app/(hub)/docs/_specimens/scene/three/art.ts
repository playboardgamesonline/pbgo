// The art of the 3D specimens: the faces and the back of a card, the felt of the table and the words written on it, all painted in code, nothing in a file. Every colour is a token of the platform resolved by the browser (`cssColor`):
// the pieces of the table (`--piece-*`) for the cards, the success and card tokens for the felt, so that a change of the tokens changes the scenes with them. The textures are made once and kept (`paintFace` keeps the cards' by key).
// This is the heavy half of the specimens: only the files of this folder import three.js and `@pbgo/table`, and they are reached through `next/dynamic` only.

import { type CardSize, onTable, paintFace } from "@pbgo/table"
import { CanvasTexture, SRGBColorSpace, type Texture } from "three"
import { cssColor, pageFont } from "../color"

/** The size of a card of every specimen, the template's. */
export const CARD_SIZE: CardSize = { width: 1.3, height: 1.9 }

export type Palette = {
  /** The felt of the table, which is also the colour the table fades into: the average of its picture */
  felt: string
  ivory: string
  ink: string
  navy: string
  /** The words on the table */
  text: string
  muted: string
  /** One colour per mark of a card */
  marks: readonly [disc: string, diamond: string, star: string, triangle: string]
}

let palette_: Palette | undefined

/** The colours of the scenes, resolved once the page has them. */
export function palette(): Palette {
  palette_ ??= {
    felt: cssColor("color-mix(in oklab, var(--success) 20%, var(--card))"),
    ivory: cssColor("var(--piece-ivory)"),
    ink: cssColor("var(--piece-ink)"),
    navy: cssColor("var(--piece-navy)"),
    text: cssColor("var(--foreground)"),
    muted: cssColor("var(--muted-foreground)"),
    marks: [
      cssColor("var(--piece-red)"),
      cssColor("color-mix(in oklab, var(--piece-navy) 82%, var(--piece-ink))"),
      cssColor("color-mix(in oklab, var(--piece-gold) 72%, var(--piece-ink))"),
      cssColor("var(--piece-ink)"),
    ],
  }
  return palette_
}

/** The ink of each colour of the sketch palette (`SKETCH_COLORS` of the defaults, in its order): the pieces' own tokens, so that a drawing is in the colours of the table */
export function inks(): string[] {
  const colors = palette()
  return [colors.ink, colors.marks[0], colors.navy, colors.marks[2]]
}

/** Where cards are dealt from in the specimens: above the middle of the table, face down. */
export const DECK = onTable(0, -0.5, { y: 3.2, face: "down", scale: 0.9 })

// A number between 0 and 1 from a seed, so that the felt is the same on every visit (and in every canvas that is made)
function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function roundedRect(g: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  g.beginPath()
  g.roundRect(x, y, width, height, radius)
}

/** The four marks of the cards: a disc, a diamond, a star and a triangle, each in the colour of its place in `Palette.marks`. */
const MARKS = ["disc", "diamond", "star", "triangle"] as const
type Mark = (typeof MARKS)[number]

function drawMark(g: CanvasRenderingContext2D, mark: Mark, x: number, y: number, r: number) {
  g.beginPath()
  if (mark === "disc") g.arc(x, y, r, 0, Math.PI * 2)
  if (mark === "diamond") {
    g.moveTo(x, y - r * 1.25)
    g.lineTo(x + r * 0.85, y)
    g.lineTo(x, y + r * 1.25)
    g.lineTo(x - r * 0.85, y)
  }
  if (mark === "star") {
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5
      const radius = i % 2 === 0 ? r * 1.2 : r * 0.5
      g[i === 0 ? "moveTo" : "lineTo"](x + Math.cos(angle) * radius, y + Math.sin(angle) * radius)
    }
  }
  if (mark === "triangle") {
    g.moveTo(x, y - r * 1.1)
    g.lineTo(x + r * 1.05, y + r * 0.8)
    g.lineTo(x - r * 1.05, y + r * 0.8)
  }
  g.closePath()
  g.fill()
}

/** How many different cards the faces make before they repeat: nine values in four marks. */
export const DECK_SIZE = 36

/** The face of card `n`: a value from one to nine and a mark, on ivory. The same `n` gives the same texture. */
export function face(n: number): Texture {
  const index = ((n % DECK_SIZE) + DECK_SIZE) % DECK_SIZE
  const mark = MARKS[index % 4] ?? "disc"
  const value = (Math.floor(index / 4) % 9) + 1
  return paintFace(`face:${index}`, CARD_SIZE, (g, w, h) => {
    const p = palette()
    const ink = p.marks[index % 4] ?? p.ink
    g.fillStyle = p.ivory
    g.fillRect(0, 0, w, h)
    g.strokeStyle = ink
    g.globalAlpha = 0.45
    g.lineWidth = 5
    roundedRect(g, 22, 22, w - 44, h - 44, 24)
    g.stroke()
    g.fillStyle = ink
    g.globalAlpha = 0.13
    drawMark(g, mark, w / 2, h / 2 + 8, w * 0.3)
    g.globalAlpha = 1
    g.textAlign = "center"
    g.textBaseline = "middle"
    g.font = `800 ${w * 0.5}px ${pageFont()}`
    g.fillText(String(value), w / 2, h / 2 + 8)
    g.font = `800 ${w * 0.15}px ${pageFont()}`
    g.fillText(String(value), 62, 74)
    drawMark(g, mark, 62, 128, 20)
    g.save()
    g.translate(w - 62, h - 74)
    g.rotate(Math.PI)
    g.fillText(String(value), 0, 0)
    drawMark(g, mark, 0, -54, 20)
    g.restore()
  })
}

/** The back of every card: navy with a lattice and a gold line, on an ivory rim. */
export function back(): Texture {
  return paintFace("back", CARD_SIZE, (g, w, h) => {
    const p = palette()
    g.fillStyle = p.ivory
    g.fillRect(0, 0, w, h)
    roundedRect(g, 18, 18, w - 36, h - 36, 22)
    g.fillStyle = p.navy
    g.fill()
    g.save()
    g.clip()
    g.strokeStyle = p.ivory
    g.globalAlpha = 0.22
    g.lineWidth = 3
    for (let d = -h; d < w + h; d += 28) {
      g.beginPath()
      g.moveTo(d, 0)
      g.lineTo(d + h, h)
      g.moveTo(d, h)
      g.lineTo(d + h, 0)
      g.stroke()
    }
    g.restore()
    g.strokeStyle = p.marks[2]
    g.lineWidth = 5
    roundedRect(g, 42, 42, w - 84, h - 84, 14)
    g.stroke()
  })
}

/** The face of a bid card: a numeral in gold on a dark panel with a red edge, on ivory. The same `n` gives the same texture. */
export function bidFace(n: number): Texture {
  return paintFace(`bid:${n}`, CARD_SIZE, (g, w, h) => {
    const p = palette()
    g.fillStyle = p.ivory
    g.fillRect(0, 0, w, h)
    roundedRect(g, 18, 18, w - 36, h - 36, 22)
    g.fillStyle = p.ink
    g.fill()
    g.strokeStyle = p.marks[0]
    g.lineWidth = 5
    roundedRect(g, 40, 40, w - 80, h - 80, 14)
    g.stroke()
    g.fillStyle = p.marks[2]
    g.textAlign = "center"
    g.textBaseline = "middle"
    g.font = `900 ${w * (n > 9 ? 0.46 : 0.62)}px ${pageFont()}`
    g.fillText(String(n), w / 2, h / 2 + 8)
    g.font = `800 ${w * 0.13}px ${pageFont()}`
    g.fillText(String(n), 76, 90)
    g.save()
    g.translate(w - 76, h - 90)
    g.rotate(Math.PI)
    g.fillText(String(n), 0, 0)
    g.restore()
  })
}

/** The back of a bid card: the dark panel with a red lattice, so that a sealed bid is not taken for a card of the deck. */
export function bidBack(): Texture {
  return paintFace("bid-back", CARD_SIZE, (g, w, h) => {
    const p = palette()
    g.fillStyle = p.ivory
    g.fillRect(0, 0, w, h)
    roundedRect(g, 18, 18, w - 36, h - 36, 22)
    g.fillStyle = p.ink
    g.fill()
    g.save()
    g.clip()
    g.strokeStyle = p.marks[0]
    g.globalAlpha = 0.4
    g.lineWidth = 3
    for (let d = -h; d < w + h; d += 28) {
      g.beginPath()
      g.moveTo(d, 0)
      g.lineTo(d + h, h)
      g.moveTo(d, h)
      g.lineTo(d + h, 0)
      g.stroke()
    }
    g.restore()
    g.globalAlpha = 1
    g.strokeStyle = p.marks[2]
    g.lineWidth = 5
    roundedRect(g, 42, 42, w - 84, h - 84, 14)
    g.stroke()
  })
}

/** The top of a token with a number on it, for a `Piece` of the specimens: the numeral in ink on the colour of the token. */
export function tokenFace(n: number, color: string): Texture {
  return paintFace(`token:${n}:${color}`, { width: 1, height: 1 }, (g, w, h) => {
    g.fillStyle = color
    g.fillRect(0, 0, w, h)
    g.fillStyle = palette().ink
    g.textAlign = "center"
    g.textBaseline = "middle"
    g.font = `900 ${w * 0.62}px ${pageFont()}`
    g.fillText(String(n), w / 2, h / 2 + h * 0.03)
  })
}

let cloth: Texture | undefined

/** The felt of the table: its colour with a grain, seamless so that the table can repeat it. */
export function felt(): Texture {
  if (cloth) return cloth
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 256
  const g = canvas.getContext("2d")!
  g.fillStyle = palette().felt
  g.fillRect(0, 0, 256, 256)
  const picture = g.getImageData(0, 0, 256, 256)
  const random = seeded(7)
  for (let i = 0; i < picture.data.length; i += 4) {
    const grain = (random() - 0.5) * 14
    picture.data[i] += grain
    picture.data[i + 1] += grain
    picture.data[i + 2] += grain
  }
  g.putImageData(picture, 0, 0)
  cloth = new CanvasTexture(canvas)
  cloth.colorSpace = SRGBColorSpace
  cloth.anisotropy = 8
  return cloth
}

export type Label = { texture: Texture; aspect: number }
const labels = new Map<string, Label>()

/** Words for the table: a texture with a transparent background and its width over its height. Kept by text and tone. */
export function label(text: string, tone: "text" | "muted" | "ink" = "muted"): Label {
  const key = `${tone}:${text}`
  const known = labels.get(key)
  if (known) return known
  const size = 96
  const font = `600 ${size}px ${pageFont()}`
  const canvas = document.createElement("canvas")
  const g = canvas.getContext("2d")!
  g.font = font
  canvas.width = Math.ceil(g.measureText(text).width) + size
  canvas.height = Math.ceil(size * 1.4)
  // Resizing a canvas resets its context
  g.font = font
  g.fillStyle = palette()[tone]
  g.textAlign = "center"
  g.textBaseline = "middle"
  g.fillText(text, canvas.width / 2, canvas.height / 2)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  const made = { texture, aspect: canvas.width / canvas.height }
  labels.set(key, made)
  return made
}
