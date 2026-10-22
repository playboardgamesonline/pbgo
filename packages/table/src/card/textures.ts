"use client"

import { CanvasTexture, RepeatWrapping } from "three"

/** Glints on a sweeping band of light. One per card that sparkles: each draws its own sparks */
export function sparkleTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 256
  const g = c.getContext("2d")!
  const grad = g.createLinearGradient(0, 256, 256, 0)
  grad.addColorStop(0.42, "rgba(255,255,255,0)")
  grad.addColorStop(0.5, "rgba(255,250,230,0.8)")
  grad.addColorStop(0.58, "rgba(255,255,255,0)")
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * 256
    const y = Math.random() * 256
    const r = 2 + Math.random() * 4
    g.fillStyle = "rgba(255,255,255,0.9)"
    g.fillRect(x - r, y - 0.6, r * 2, 1.2)
    g.fillRect(x - 0.6, y - r, 1.2, r * 2)
  }
  const t = new CanvasTexture(c)
  t.wrapS = RepeatWrapping
  return t
}

let gloss: CanvasTexture | null = null
/** The shine that follows the pointer over a hovered card. One for all: the card under the pointer slides its offset */
export function glossTexture() {
  if (gloss) return gloss
  const c = document.createElement("canvas")
  c.width = c.height = 256
  const g = c.getContext("2d")!
  const grad = g.createLinearGradient(0, 256, 256, 0)
  grad.addColorStop(0.25, "rgba(255,255,255,0)")
  grad.addColorStop(0.42, "rgba(255,245,220,0.3)")
  grad.addColorStop(0.5, "rgba(255,255,255,0.6)")
  grad.addColorStop(0.53, "rgba(255,255,255,0.2)")
  grad.addColorStop(0.6, "rgba(255,245,220,0.35)")
  grad.addColorStop(0.75, "rgba(255,255,255,0)")
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  const t = new CanvasTexture(c)
  t.repeat.set(0.6, 0.6)
  t.center.set(0.5, 0.5)
  gloss = t
  return t
}

let shadow: CanvasTexture | null = null
/** A soft dark spot, the card's drop shadow */
export function shadowTexture() {
  if (!shadow) {
    const c = document.createElement("canvas")
    c.width = c.height = 128
    const g = c.getContext("2d")!
    const grad = g.createRadialGradient(64, 64, 20, 64, 64, 64)
    grad.addColorStop(0, "rgba(0,0,0,0.55)")
    grad.addColorStop(1, "rgba(0,0,0,0)")
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    shadow = new CanvasTexture(c)
  }
  return shadow
}

const halos = new Map<string, CanvasTexture>()
/** A blurred white card shape with `margin` of blur all around, tinted by the material that wears it. One per size */
export function haloTexture(width: number, height: number, margin: number, radius = Math.min(width, height) * 0.06) {
  const key = `${width.toFixed(2)}:${height.toFixed(2)}:${margin.toFixed(2)}:${radius.toFixed(3)}`
  let t = halos.get(key)
  if (!t) {
    const scale = 160 / (width + 2 * margin)
    const c = document.createElement("canvas")
    c.width = Math.round((width + 2 * margin) * scale)
    c.height = Math.round((height + 2 * margin) * scale)
    const g = c.getContext("2d")!
    g.shadowColor = "white"
    g.shadowBlur = margin * scale * 0.9
    g.fillStyle = "white"
    g.beginPath()
    g.roundRect(margin * scale, margin * scale, width * scale, height * scale, radius * scale)
    g.fill()
    g.fill()
    t = new CanvasTexture(c)
    halos.set(key, t)
  }
  return t
}
