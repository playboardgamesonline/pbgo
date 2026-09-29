"use client"

import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three"

export type Pattern = "losanges"

const GOLD = "rgba(240, 214, 150, 1)"
const SIZE = 256

function grain(g: CanvasRenderingContext2D, seedValue: number) {
  let s = seedValue
  const random = () => (s = (s * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = random() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.07)"
    g.fillRect(random() * SIZE, random() * SIZE, 1.2, 1.2)
  }
}

function diamonds(g: CanvasRenderingContext2D) {
  g.strokeStyle = GOLD
  g.fillStyle = GOLD
  g.lineWidth = 1.5
  const m = SIZE / 2
  g.beginPath()
  g.moveTo(m, 0)
  g.lineTo(SIZE, m)
  g.lineTo(m, SIZE)
  g.lineTo(0, m)
  g.closePath()
  g.stroke()
  g.setLineDash([3, 7])
  g.beginPath()
  g.moveTo(m, 22)
  g.lineTo(SIZE - 22, m)
  g.lineTo(m, SIZE - 22)
  g.lineTo(22, m)
  g.closePath()
  g.stroke()
  g.setLineDash([])
  for (const [x, y, r] of [
    [m, 0, 5],
    [SIZE, m, 5],
    [m, SIZE, 5],
    [0, m, 5],
    [m, m, 3],
    [0, 0, 3],
    [SIZE, 0, 3],
    [0, SIZE, 3],
    [SIZE, SIZE, 3],
  ]) {
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fill()
  }
}

const cache = new Map<Pattern, CanvasTexture>()

export function patternTexture(pattern: Pattern) {
  let t = cache.get(pattern)
  if (!t) {
    const c = document.createElement("canvas")
    c.width = c.height = SIZE
    const g = c.getContext("2d")!
    diamonds(g)
    grain(g, pattern.length * 977 + 13)
    t = new CanvasTexture(c)
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(30, 22.5)
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 8
    cache.set(pattern, t)
  }
  return t
}
