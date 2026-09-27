"use client"

import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three"

export const MOTIFS = { aucun: "aucun", "Damas royal": "damas", "Losanges & perles": "losanges", "Étoiles de cour": "etoiles" } as const
export type Motif = (typeof MOTIFS)[keyof typeof MOTIFS]

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

function damas(g: CanvasRenderingContext2D) {
  g.strokeStyle = OR
  g.fillStyle = OR
  g.lineWidth = 2
  const motif = (cx: number, cy: number, r: number) => {
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2
      g.beginPath()
      g.ellipse(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.5, r * 0.26, a, 0, Math.PI * 2)
      g.stroke()
    }
    g.beginPath()
    g.arc(cx, cy, r * 0.12, 0, Math.PI * 2)
    g.fill()
  }
  for (const [x, y] of [
    [0, 0],
    [TAILLE, 0],
    [0, TAILLE],
    [TAILLE, TAILLE],
    [TAILLE / 2, TAILLE / 2],
  ])
    motif(x, y, 64)
  g.globalAlpha = 0.6
  for (const [x, y] of [
    [TAILLE / 2, 0],
    [TAILLE / 2, TAILLE],
    [0, TAILLE / 2],
    [TAILLE, TAILLE / 2],
  ]) {
    g.beginPath()
    g.arc(x, y, 5, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1
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

function etoile(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, branches: number) {
  g.beginPath()
  for (let i = 0; i < branches * 2; i++) {
    const a = (i * Math.PI) / branches - Math.PI / 2
    const rr = i % 2 ? r * 0.38 : r
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
  }
  g.closePath()
  g.fill()
}

function etoiles(g: CanvasRenderingContext2D) {
  g.fillStyle = OR
  etoile(g, 64, 64, 22, 6)
  etoile(g, 192, 192, 22, 6)
  g.globalAlpha = 0.7
  etoile(g, 192, 60, 9, 4)
  etoile(g, 60, 196, 9, 4)
  etoile(g, 128, 128, 6, 4)
  etoile(g, 0, 128, 6, 4)
  etoile(g, 256, 128, 6, 4)
  etoile(g, 128, 0, 6, 4)
  etoile(g, 128, 256, 6, 4)
  g.globalAlpha = 1
}

const cache = new Map<Motif, CanvasTexture>()

export function textureMotif(motif: Motif) {
  let t = cache.get(motif)
  if (!t) {
    const c = document.createElement("canvas")
    c.width = c.height = TAILLE
    const g = c.getContext("2d")!
    if (motif === "damas") damas(g)
    if (motif === "losanges") losanges(g)
    if (motif === "etoiles") etoiles(g)
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
