import { CanvasTexture, SRGBColorSpace } from "three"
import { cssColor } from "../color"
import type { TileName } from "../landscape"

// The faces of the tiles of the landscape specimen, painted on a canvas from the platform's own tokens: a tile is drawn with its north up, and the `Piece` that wears it is turned by `tileYaw`, so the picture turns with it. What a game would draw
// from its own pictures, these draw from lines: a field, a road with an edge, a city with a wall, a roof where roads meet.

const SIZE = 256

type Ink = { field: string; road: string; roadEdge: string; city: string; wall: string; roof: string }
let inks_: Ink | null = null
function inks(): Ink {
  inks_ ??= {
    field: cssColor("color-mix(in oklab, var(--success) 42%, var(--piece-ivory))"),
    road: cssColor("var(--piece-ivory)"),
    roadEdge: cssColor("color-mix(in oklab, var(--piece-ink) 32%, var(--piece-ivory))"),
    city: cssColor("color-mix(in oklab, var(--piece-red) 52%, var(--piece-ivory))"),
    wall: cssColor("color-mix(in oklab, var(--piece-red) 72%, var(--piece-ink))"),
    roof: cssColor("var(--piece-red)"),
  }
  return inks_
}

type Pen = CanvasRenderingContext2D

/** A road along a path: an edge a little wider than the road, then the road */
function road(g: Pen, ink: Ink, path: (g: Pen) => void) {
  g.lineCap = "butt"
  g.lineJoin = "round"
  for (const [width, color] of [
    [0.27, ink.roadEdge],
    [0.2, ink.road],
  ] as const) {
    g.lineWidth = width
    g.strokeStyle = color
    g.beginPath()
    path(g)
    g.stroke()
  }
}

/** A city: its shape filled, with a wall along its outline */
function city(g: Pen, ink: Ink, shape: (g: Pen) => void) {
  g.beginPath()
  shape(g)
  g.closePath()
  g.fillStyle = ink.city
  g.fill()
  g.lineWidth = 0.04
  g.lineJoin = "round"
  g.strokeStyle = ink.wall
  g.stroke()
}

/** What is painted on each tile, in a square of side 1 with the north at the top */
const PAINT: Record<TileName, (g: Pen, ink: Ink) => void> = {
  meadow: () => {},
  straight: (g, ink) =>
    road(g, ink, (p) => {
      p.moveTo(0.5, 0)
      p.lineTo(0.5, 1)
    }),
  curve: (g, ink) =>
    road(g, ink, (p) => {
      p.moveTo(0.5, 1)
      p.quadraticCurveTo(0.5, 0.5, 0, 0.5)
    }),
  crossroads: (g, ink) => {
    road(g, ink, (p) => {
      p.moveTo(0, 0.5)
      p.lineTo(1, 0.5)
      p.moveTo(0.5, 0.5)
      p.lineTo(0.5, 1)
    })
    g.fillStyle = ink.roof
    g.fillRect(0.41, 0.41, 0.18, 0.18)
  },
  cap: (g, ink) =>
    city(g, ink, (p) => {
      p.moveTo(0, 0)
      p.lineTo(1, 0)
      p.lineTo(1, 0.2)
      p.quadraticCurveTo(0.5, 0.5, 0, 0.2)
    }),
  corner: (g, ink) =>
    city(g, ink, (p) => {
      p.moveTo(0, 0)
      p.lineTo(1, 0)
      p.lineTo(1, 1)
      p.quadraticCurveTo(0.4, 0.6, 0, 0)
    }),
  bridge: (g, ink) =>
    city(g, ink, (p) => {
      p.moveTo(0, 0)
      p.lineTo(1, 0)
      p.quadraticCurveTo(0.62, 0.5, 1, 1)
      p.lineTo(0, 1)
      p.quadraticCurveTo(0.38, 0.5, 0, 0)
    }),
  gate: (g, ink) => {
    road(g, ink, (p) => {
      p.moveTo(0, 0.55)
      p.lineTo(1, 0.55)
    })
    city(g, ink, (p) => {
      p.moveTo(0, 0)
      p.lineTo(1, 0)
      p.lineTo(1, 0.16)
      p.quadraticCurveTo(0.5, 0.4, 0, 0.16)
    })
  },
}

const made = new Map<TileName, CanvasTexture>()

/** The picture on the face of a tile, made the first time it is asked for and then kept: a texture is a resource of the card, shared by every tile that shows it */
export function tileFace(name: TileName): CanvasTexture {
  let texture = made.get(name)
  if (!texture) {
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = SIZE
    const g = canvas.getContext("2d")
    const ink = inks()
    if (g) {
      g.scale(SIZE, SIZE)
      g.fillStyle = ink.field
      g.fillRect(0, 0, 1, 1)
      PAINT[name](g, ink)
    }
    texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 8
    made.set(name, texture)
  }
  return texture
}

/** The colour of the ring that marks a tile of a road or a city that is closed: gold, which shows on a road and on a city alike */
export const doneColor = () => cssColor("var(--piece-gold)")
