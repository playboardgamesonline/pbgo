"use client"

import { useCursor } from "@react-three/drei"
import { type ThreeEvent, useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef, useState } from "react"
import { CanvasTexture, SRGBColorSpace } from "three"
import { shadowTexture } from "../card/textures"
import { useSettingsVersion } from "../debug/settings"
import { useFontReady } from "../font"
import { TABLE_FONT } from "../seat/table-text"
import { paintPaper } from "../sketch/paint"
import { toSheet } from "../sketch/sheet"
import { cellAt, type SheetCell } from "./cells"
import { SHEET_SETTINGS } from "./settings"

/** What a cell shows. A field left out is the sheet's own */
export type SheetLook = {
  /** What is written in the cell: a score, a number. The letters shrink until they fit the cell */
  text?: string
  /** A mark drawn over the cell: a tick, a cross, a circle */
  mark?: "tick" | "cross" | "circle"
  /** The colour of the writing and of the mark (default the ink) */
  color?: string
  /** The writing is a suggestion, in faint ink: what the cell would take if it were chosen */
  faint?: boolean
  /** The colour of the cell's own background */
  fill?: string
  /** The cell is not drawn at all, border included: a place in the list that the paper has no box for */
  hidden?: boolean
}

export type SheetProps = {
  /** Where the middle of the sheet lies on the table and the way it faces (`yaw`, radians about the vertical axis, counterclockwise from above: its top is away from the viewer when it faces them) */
  at: { x: number; z: number; yaw?: number }
  /** Its size in world units */
  width: number
  height: number
  /** The cells, as parts of the sheet: `gridCells` cuts a grid, and a sheet of another shape lists its cells. The number of a cell is its place in the list. Keep the list from one render to the next */
  cells: readonly SheetCell[]
  /** What each cell shows, from the game's state. Called for every cell whenever the sheet is painted */
  look?: (index: number) => SheetLook
  /** What is printed on the paper under the cells: the title, the names of the rows, the rules between the boxes. Called with the canvas the sheet is painted on and its size in pixels, whenever it is painted, so it may write what the state says (a total) */
  printed?: (g: CanvasRenderingContext2D, size: { width: number; height: number }) => void
  /** The numbers of the cells that can be chosen now: each is ringed, and only those can be pressed. Without it nothing is ringed and every cell can be pressed when there is a handler */
  halo?: readonly number[] | null
  /** Pressing a cell does this, with its number */
  onCell?: (index: number) => void
  /** The pointer comes onto a cell that can be pressed, with its number, and leaves it (null) */
  onHover?: (index: number | null) => void
  /** The colour of the paper, of the ink, and of the ring and the tint of a choice (a warm paper, a dark ink and an orange by default) */
  paper?: string
  ink?: string
  accent?: string
  /** The CSS font of the writing, `TABLE_FONT` by default */
  font?: string
  /** Nobody can press a cell now (it is not the player's turn): nothing is ringed or tinted */
  disabled?: boolean
}

/** Pixels the picture has for each unit of the table */
const PX = 140
/** The picture is never wider or taller than this, whatever the size of the sheet */
const LIMIT = 2048
/** How high above the table the sheet lies: over the surface, under the cards */
const HEIGHT = 0.016
const PAPER = "#f6f1e4"
const INK = "#26231f"
const ACCENT = "#d9822b"

/** Tells the graphics card that the picture a canvas holds has been painted again: a texture is a resource of the card, not a value of the page */
function changed(texture: CanvasTexture) {
  texture.needsUpdate = true
}

type Flags = { listed: boolean; hovered: boolean }

/** Paints one cell: its background, its border, a ring when it can be chosen, a tint under the pointer, what is written in it and its mark */
function paintCell(g: CanvasRenderingContext2D, cell: SheetCell, look: SheetLook, { ink, accent, font }: { ink: string; accent: string; font: string }, { listed, hovered }: Flags, size: { width: number; height: number }) {
  if (look.hidden) return
  const S = SHEET_SETTINGS
  const [x, y, w, h] = [cell.x * size.width, cell.y * size.height, cell.width * size.width, cell.height * size.height]
  const radius = Math.min(w, h) * S.radius
  const outline = () => {
    g.beginPath()
    g.roundRect(x, y, w, h, radius)
  }
  if (look.fill) {
    outline()
    g.fillStyle = look.fill
    g.fill()
  }
  if (listed) {
    outline()
    g.globalAlpha = S.haloTint
    g.fillStyle = accent
    g.fill()
    g.globalAlpha = 1
  }
  if (hovered) {
    outline()
    g.globalAlpha = S.hoverTint
    g.fillStyle = accent
    g.fill()
    g.globalAlpha = 1
  }
  outline()
  if (listed) {
    g.lineWidth = S.haloWidth
    g.strokeStyle = accent
  } else {
    g.lineWidth = S.border
    g.strokeStyle = ink
    g.globalAlpha = S.borderOpacity
  }
  g.stroke()
  g.globalAlpha = 1

  const color = look.color ?? ink
  if (look.text) {
    // The writing is as tall as `textSize` of the cell, and shrinks until it fits its width
    let px = h * S.textSize
    g.font = `800 ${px}px ${font}`
    const wide = g.measureText(look.text).width
    if (wide > w * 0.88) {
      px *= (w * 0.88) / wide
      g.font = `800 ${px}px ${font}`
    }
    g.textAlign = "center"
    g.textBaseline = "middle"
    g.globalAlpha = look.faint ? S.faint : 1
    g.fillStyle = color
    g.fillText(look.text, x + w / 2, y + h / 2 + px * 0.04)
    g.globalAlpha = 1
  }
  if (look.mark) {
    const [cx, cy] = [x + w / 2, y + h / 2]
    const reach = (Math.min(w, h) * S.markSize) / 2
    g.lineWidth = Math.min(w, h) * S.markWidth
    g.lineCap = "round"
    g.lineJoin = "round"
    g.strokeStyle = color
    g.beginPath()
    if (look.mark === "tick") {
      g.moveTo(cx - reach * 0.7, cy + reach * 0.05)
      g.lineTo(cx - reach * 0.2, cy + reach * 0.6)
      g.lineTo(cx + reach * 0.75, cy - reach * 0.6)
    } else if (look.mark === "cross") {
      g.moveTo(cx - reach * 0.7, cy - reach * 0.7)
      g.lineTo(cx + reach * 0.7, cy + reach * 0.7)
      g.moveTo(cx + reach * 0.7, cy - reach * 0.7)
      g.lineTo(cx - reach * 0.7, cy + reach * 0.7)
    } else {
      g.arc(cx, cy, reach * 0.85, 0, Math.PI * 2)
    }
    g.stroke()
  }
}

/**
 * A sheet of paper on the table with boxes that are marked and filled: the scorecard of Yahtzee, the sheet of Welcome To. The boxes are `cells`, rectangles as parts of the sheet, which `gridCells` cuts or the game lists; what each shows (a score,
 * a tick, a cross, a suggestion in faint ink) comes from the state through `look`, and what is printed on the paper, the title and the names of the rows, is drawn by `printed`. The cells that can be chosen are ringed, and pressing one calls
 * `onCell` with its number. The picture is the sheet's own, painted on a canvas and laid on the table like the cards, so it is lit, turned and covered as they are. The sheet keeps no state of its own: it shows what it is given and says what was pressed.
 */
export function Sheet({ at, width, height, cells, look, printed, halo = null, onCell, onHover, paper = PAPER, ink = INK, accent = ACCENT, font = TABLE_FONT, disabled = false }: SheetProps) {
  // Painted again when the panel changes a setting
  useSettingsVersion()
  const fontReady = useFontReady(font, 800)
  const yaw = at.yaw ?? 0
  const live = !disabled && !!onCell
  const pressable = (index: number) => live && (halo === null || halo.includes(index))
  // The cell under the pointer, while it can be pressed: a cell that is written, or a turn that ends, under a pointer that rests ends the hover with no move
  const [over, setOver] = useState<number | null>(null)
  const hover = over !== null && pressable(over) ? over : null
  useCursor(hover !== null, "pointer")
  const [shadowTex] = useState(shadowTexture)

  const box = useMemo(() => ({ width: Math.min(LIMIT, Math.round(width * PX)), height: Math.min(LIMIT, Math.round(height * PX)) }), [width, height])
  const { canvas, texture } = useMemo(() => {
    const surface = document.createElement("canvas")
    surface.width = box.width
    surface.height = box.height
    const map = new CanvasTexture(surface)
    map.colorSpace = SRGBColorSpace
    map.anisotropy = 8
    return { canvas: surface, texture: map }
  }, [box.width, box.height])
  useEffect(() => () => texture.dispose(), [texture])

  // What a frame paints: the newest props and whether the picture is out of date. Painting is left to the frame, so that a sheet that changes ten times in a render paints once
  const latest = useRef({ cells, look, printed, halo, paper, ink, accent, font, hover, live })
  const dirty = useRef(true)
  const told = useRef<number | null>(null)
  useEffect(() => {
    latest.current = { cells, look, printed, halo, paper, ink, accent, font, hover, live }
    dirty.current = true
    // The game is told when the pointer comes onto a cell that can be pressed and when it leaves it, which is also when the cell stops being one
    if (told.current !== hover) {
      told.current = hover
      onHover?.(hover)
    }
  })
  useEffect(() => {
    dirty.current = true
  }, [fontReady])

  useFrame(() => {
    if (!dirty.current) return
    dirty.current = false
    const g = canvas.getContext("2d")
    if (!g) return
    const now = latest.current
    paintPaper(g, box.width, box.height, now.paper)
    now.printed?.(g, { width: box.width, height: box.height })
    const listed = now.live && now.halo ? new Set(now.halo) : null
    now.cells.forEach((cell, index) => {
      paintCell(g, cell, now.look?.(index) ?? {}, { ink: now.ink, accent: now.accent, font: now.font }, { listed: listed?.has(index) === true, hovered: now.live && now.hover === index }, box)
    })
    changed(texture)
  })

  /** The cell under the pointer that can be pressed, or -1 */
  const under = (event: ThreeEvent<PointerEvent | MouseEvent>) => {
    const [u, v] = toSheet({ x: event.point.x, z: event.point.z }, { x: at.x, z: at.z, yaw, width, height })
    const index = cellAt(cells, u, v)
    return index >= 0 && pressable(index) ? index : -1
  }
  const move = (event: ThreeEvent<PointerEvent>) => {
    const index = under(event)
    setOver(index >= 0 ? index : null)
  }
  const leave = () => setOver(null)
  const press = (event: ThreeEvent<MouseEvent>) => {
    const index = under(event)
    if (index < 0) return
    event.stopPropagation()
    onCell?.(index)
  }

  return (
    <group position={[at.x, HEIGHT, at.z]} rotation-y={yaw}>
      <group rotation-x={-Math.PI / 2}>
        <mesh position={[width * 0.02, -height * 0.04, -0.004]} renderOrder={1} raycast={() => null}>
          <planeGeometry args={[width * 1.1, height * 1.14]} />
          <meshBasicMaterial map={shadowTex} transparent opacity={0.8} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh renderOrder={2} {...(live ? { onPointerMove: move, onPointerOut: leave, onClick: press } : { raycast: () => null })}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}
