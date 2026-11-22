"use client"

import type { Card, CardColor } from "@template/engine"
import { type CardSize, type MatLayer, paintFace } from "@pbgo/table"
import type { Texture } from "three"

/** Width and height of a card in world units: the same for every card of the game */
export const CARD_SIZE: CardSize = { width: 1.3, height: 1.9 }

export const CARD_STYLES: Record<CardColor, { bg: string; ink: string; symbol: string }> = {
  sun: { bg: "#f4c542", ink: "#5a3b00", symbol: "☀" },
  moon: { bg: "#8fb3e8", ink: "#16305a", symbol: "☾" },
  star: { bg: "#e88fb3", ink: "#5a1633", symbol: "★" },
  comet: { bg: "#8fe8c2", ink: "#0f4a36", symbol: "✦" },
}

const FONT = 'ui-rounded, "Avenir Next", "Nunito", system-ui, sans-serif'

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, l: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, l, h, r)
}

export function faceTexture(card: Card): Texture {
  const { bg, ink, symbol } = CARD_STYLES[card.color]
  return paintFace(card.id, CARD_SIZE, (ctx, w, h) => {
    ctx.fillStyle = "#fbf8f1"
    ctx.fillRect(0, 0, w, h)
    rounded(ctx, 18, 18, w - 36, h - 36, 22)
    ctx.fillStyle = bg
    ctx.fill()
    ctx.fillStyle = ink
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.font = `900 190px ${FONT}`
    ctx.fillText(String(card.value), w / 2, h / 2 + 8)
    ctx.font = `700 54px ${FONT}`
    ctx.fillText(String(card.value), 58, 66)
    ctx.fillText(symbol, 58, 124)
    ctx.save()
    ctx.translate(w - 58, h - 66)
    ctx.rotate(Math.PI)
    ctx.fillText(String(card.value), 0, 0)
    ctx.fillText(symbol, 0, -58)
    ctx.restore()
    ctx.globalAlpha = 0.18
    ctx.font = `400 300px ${FONT}`
    ctx.fillText(symbol, w / 2, h / 2 + 10)
  })
}

export function backTexture(accent = "#e8b43a", bg = "#1b2c4a"): Texture {
  return paintFace(`back:${accent}:${bg}`, CARD_SIZE, (ctx, w, h) => {
    ctx.fillStyle = "#fbf8f1"
    ctx.fillRect(0, 0, w, h)
    rounded(ctx, 18, 18, w - 36, h - 36, 22)
    ctx.fillStyle = bg
    ctx.fill()
    ctx.save()
    ctx.clip()
    ctx.strokeStyle = accent
    ctx.globalAlpha = 0.35
    ctx.lineWidth = 3
    for (let d = -h; d < w + h; d += 28) {
      ctx.beginPath()
      ctx.moveTo(d, 0)
      ctx.lineTo(d + h, h)
      ctx.moveTo(d, h)
      ctx.lineTo(d + h, 0)
      ctx.stroke()
    }
    ctx.restore()
    ctx.globalAlpha = 1
    ctx.strokeStyle = accent
    ctx.lineWidth = 6
    rounded(ctx, 42, 42, w - 84, h - 84, 14)
    ctx.stroke()
  })
}

/** The bid cards: a numeral in gold on a dark panel, a vermilion back. They are of the game's own look, drawn like the rest of its cards */
export function bidFaceTexture(amount: number): Texture {
  return paintFace(`bid:${amount}`, CARD_SIZE, (ctx, w, h) => {
    ctx.fillStyle = "#fbf8f1"
    ctx.fillRect(0, 0, w, h)
    rounded(ctx, 18, 18, w - 36, h - 36, 22)
    ctx.fillStyle = "#2b1d1a"
    ctx.fill()
    ctx.strokeStyle = "#e0613a"
    ctx.lineWidth = 6
    rounded(ctx, 40, 40, w - 80, h - 80, 14)
    ctx.stroke()
    ctx.fillStyle = "#f2c14e"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.font = `900 ${amount > 9 ? 170 : 230}px ${FONT}`
    ctx.fillText(String(amount), w / 2, h / 2 + 8)
    ctx.font = `700 46px ${FONT}`
    ctx.fillText(String(amount), 78, 92)
    ctx.save()
    ctx.translate(w - 78, h - 92)
    ctx.rotate(Math.PI)
    ctx.fillText(String(amount), 0, 0)
    ctx.restore()
  })
}

export const bidBackTexture = (): Texture => backTexture("#e0613a", "#2b1d1a")

/** The mat the table lies on: a very dark grey with a diamond lattice a hair lighter, as a printed playing mat has, with no grain; and a pool of light on its middle, so that it is lit there and falls away to black toward its edges, as the table of Courtisans does */
export const MAT_COLOR = "#0c0c0e"
export const MAT_LINE = "#17171b"
export const MAT_LIGHT = { color: "#2c2c31", radius: 20 }

/** What lies on the colour of the mat, from the bottom up: the lattice, which the table bakes once into the picture that repeats over it */
export const MAT_LAYERS: MatLayer[] = [{ kind: "lattice", line: MAT_LINE, diamonds: 3, width: 2.5 }]

/** Pixels across the baked picture of the mat: the width of a line is given in them, so a larger one would make the lines finer */
export const MAT_RESOLUTION = 256
