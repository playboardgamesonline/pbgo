import { ExtrudeGeometry, Shape, ShapeGeometry } from "three"

/** A card's size in world units. The corners are rounded to 6% of the smaller side unless the game sets its own radius */
export type CardSize = { width: number; height: number; radius?: number }

const ROUNDING = 0.06

/** The corner radius of a card of this size */
export const cornerRadius = ({ width, height, radius }: CardSize) => radius ?? Math.min(width, height) * ROUNDING

/** A rounded rectangle centred on the origin, in the XY plane */
export function roundedRect(width: number, height: number, radius: number) {
  const x = -width / 2
  const y = -height / 2
  const s = new Shape()
  s.moveTo(x + radius, y)
  s.lineTo(x + width - radius, y)
  s.quadraticCurveTo(x + width, y, x + width, y + radius)
  s.lineTo(x + width, y + height - radius)
  s.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  s.lineTo(x + radius, y + height)
  s.quadraticCurveTo(x, y + height, x, y + height - radius)
  s.lineTo(x, y + radius)
  s.quadraticCurveTo(x, y, x + radius, y)
  return s
}

const faces = new Map<string, ShapeGeometry>()
const slices = new Map<string, ExtrudeGeometry>()
const frames = new Map<string, ShapeGeometry>()

/** The side of a card: the rounded rectangle, its UVs laid so the picture covers it edge to edge. One geometry per size, shared by every card */
export function cardGeometry(width: number, height: number, radius = Math.min(width, height) * ROUNDING) {
  const key = `${width.toFixed(3)}:${height.toFixed(3)}:${radius.toFixed(3)}`
  let geo = faces.get(key)
  if (!geo) {
    const x = -width / 2
    const y = -height / 2
    geo = new ShapeGeometry(roundedRect(width, height, radius), 6)
    const pos = geo.attributes.position!
    const uv = geo.attributes.uv!
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - x) / width, (pos.getY(i) - y) / height)
    uv.needsUpdate = true
    faces.set(key, geo)
  }
  return geo
}

/** The thickness of a card: the rounded rectangle extruded from z = 0 to z = `thickness`. Group 1 is the rim, group 0 the two caps */
export function edgeGeometry(width: number, height: number, thickness: number, radius = Math.min(width, height) * ROUNDING) {
  const key = `${width.toFixed(3)}:${height.toFixed(3)}:${thickness.toFixed(4)}:${radius.toFixed(3)}`
  let geo = slices.get(key)
  if (!geo) {
    geo = new ExtrudeGeometry(roundedRect(width, height, radius), { depth: thickness, bevelEnabled: false, curveSegments: 6 })
    slices.set(key, geo)
  }
  return geo
}

/** A ring around the card: `gap` away from its edge, `thickness` wide */
export function frameGeometry(width: number, height: number, gap: number, thickness: number, radius = Math.min(width, height) * ROUNDING) {
  const key = `${width.toFixed(3)}:${height.toFixed(3)}:${gap.toFixed(3)}:${thickness.toFixed(3)}:${radius.toFixed(3)}`
  let geo = frames.get(key)
  if (!geo) {
    const outer = roundedRect(width + 2 * (gap + thickness), height + 2 * (gap + thickness), radius + gap + thickness)
    outer.holes.push(roundedRect(width + 2 * gap, height + 2 * gap, radius + gap))
    geo = new ShapeGeometry(outer, 8)
    frames.set(key, geo)
  }
  return geo
}
