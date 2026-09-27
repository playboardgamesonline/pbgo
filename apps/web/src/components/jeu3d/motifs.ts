"use client"

import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three"

export type Motif = "losanges"

const OR = "rgba(240, 214, 150, 1)"
const TAILLE = 256

function grain(g: CanvasRenderingContext2D, graine: number) {
  let s = graine
  const hasard = () => (s = (s * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = hasard() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.07)"
    g.fillRect(hasard() * TAILLE, hasard() * TAILLE, 1.2, 1.2)
  }
}

function losanges(g: CanvasRenderingContext2D) {
  g.strokeStyle = OR
  g.fillStyle = OR
  g.lineWidth = 1.5
  const m = TAILLE / 2
  g.beginPath()
  g.moveTo(m, 0)
  g.lineTo(TAILLE, m)
  g.lineTo(m, TAILLE)
  g.lineTo(0, m)
  g.closePath()
  g.stroke()
  g.setLineDash([3, 7])
  g.beginPath()
  g.moveTo(m, 22)
  g.lineTo(TAILLE - 22, m)
  g.lineTo(m, TAILLE - 22)
  g.lineTo(22, m)
  g.closePath()
  g.stroke()
  g.setLineDash([])
  for (const [x, y, r] of [
    [m, 0, 5],
    [TAILLE, m, 5],
    [m, TAILLE, 5],
    [0, m, 5],
    [m, m, 3],
    [0, 0, 3],
    [TAILLE, 0, 3],
    [0, TAILLE, 3],
    [TAILLE, TAILLE, 3],
  ]) {
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fill()
  }
}

const cache = new Map<Motif, CanvasTexture>()

export function textureMotif(motif: Motif) {
  let t = cache.get(motif)
  if (!t) {
    const c = document.createElement("canvas")
    c.width = c.height = TAILLE
    const g = c.getContext("2d")!
    losanges(g)
    grain(g, motif.length * 977 + 13)
    t = new CanvasTexture(c)
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(30, 22.5)
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 8
    cache.set(motif, t)
  }
  return t
}
