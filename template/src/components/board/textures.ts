"use client"

import type { Card, CardColor } from "@template/engine"
import { type CardSize, paintFace } from "@pbgo/table"
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from "three"

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

function finalize(c: HTMLCanvasElement) {
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  return t
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

let mat: Texture | null = null
export function matTexture(): Texture {
  if (mat) return mat
  const c = document.createElement("canvas")
  c.width = c.height = 256
  const ctx = c.getContext("2d")!
  ctx.fillStyle = "#1f5a4a"
  ctx.fillRect(0, 0, 256, 256)
  const img = ctx.getImageData(0, 0, 256, 256)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 18
    img.data[i] = img.data[i]! + n
    img.data[i + 1] = img.data[i + 1]! + n
    img.data[i + 2] = img.data[i + 2]! + n
  }
  ctx.putImageData(img, 0, 0)
  mat = finalize(c)
  mat.wrapS = mat.wrapT = RepeatWrapping
  mat.repeat.set(6, 4)
  return mat
}
