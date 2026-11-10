"use client"

import { useCursor } from "@react-three/drei"
import { type ThreeEvent, useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef, useState } from "react"
import { BufferAttribute, BufferGeometry, CanvasTexture, type MeshBasicMaterial, SRGBColorSpace } from "three"
import { useFontReady } from "../font"
import { TABLE_FONT } from "../seat/table-text"
import { type Atlas, atlasOf, cellRect, fitSize, type PlateSize, plateSize, type Quads, quadsOf, spaceOfFace, WHOLE } from "./atlas"
import type { Space } from "./path"

/** What a space shows: the label written on its plate, the colour of the plate and the colour of the ink. A field left out is the track's own */
export type SpaceLook = { label?: string; color?: string; ink?: string }

export type TrackProps = {
  /** The spaces of the track in order, from `lineSpaces`, `loopSpaces`, `arcSpaces`, `snakeSpaces`, `pathSpaces`, or the points the game works out. Keep the list from one render to the next, or compute it in `useMemo` */
  spaces: readonly Space[]
  /** The size of a plate in world units: its side, or its width and depth. Default: a little under the distance to the nearest neighbour, so that two plates never touch */
  size?: number | PlateSize
  /** What each space shows: its label (a number, a word, a sign), the colour of its plate and of its ink. Called for every space whenever the track is drawn, so it comes from the game's data and the visitor's language */
  look?: (index: number) => SpaceLook
  /** The plates face the viewer whichever way their space faces, so a label always reads upright (default true). Without it a plate turns with its space, the way the track goes */
  upright?: boolean
  /** The spaces that can be chosen: a ring pulses round each. None when null */
  halo?: readonly number[] | null
  /** The colour of the ring, and of the ring under the pointer */
  haloColor?: string
  /** Pressing a space does this, with its number. Without it the plates only show. A space under the pointer takes a ring */
  onSpace?: (index: number) => void
  /** The pointer comes onto a space, with its number, and leaves it, with null */
  onHover?: (index: number | null) => void
  /** The CSS font of the labels, `TABLE_FONT` by default */
  font?: string
  /** The colour of the plates and of the ink of the spaces that give none */
  color?: string
  ink?: string
}

const PLATE = "#ece3cd"
const INK = "#2b261f"
const RING = "#ffffff"
// How high the plates and the rings lie above the table: over the surface and under the shadows of the pieces, which lie at 0.012
const PLATE_HEIGHT = 0.006
const RING_HEIGHT = 0.009
// How much bigger than its plate the ring round a space is
const RING_GROW = 1.2

/** What a plate is painted from: every field is there, the track's own filling in for the ones the game left out */
type Look = { label: string; color: string; ink: string }

function geometryOf({ positions, uvs, indices }: Quads): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute("position", new BufferAttribute(positions, 3))
  geometry.setAttribute("uv", new BufferAttribute(uvs, 2))
  geometry.setIndex(new BufferAttribute(indices, 1))
  return geometry
}

/** Paints the plates, one in each cell of the atlas: a rounded plate with its edge, and its label in the middle in letters that shrink to fit */
function paintPlates(canvas: HTMLCanvasElement, atlas: Atlas, looks: readonly Look[], font: string): void {
  const g = canvas.getContext("2d")
  if (!g) return
  g.clearRect(0, 0, canvas.width, canvas.height)
  const inset = Math.max(2, Math.round(Math.min(atlas.cellWidth, atlas.cellHeight) * 0.04))
  const measure = (text: string, size: number) => {
    g.font = `700 ${size}px ${font}`
    return g.measureText(text).width
  }
  looks.forEach((look, i) => {
    const x0 = (i % atlas.columns) * atlas.cellWidth
    const y0 = Math.floor(i / atlas.columns) * atlas.cellHeight
    const [width, height] = [atlas.cellWidth - 2 * inset, atlas.cellHeight - 2 * inset]
    g.beginPath()
    g.roundRect(x0 + inset, y0 + inset, width, height, Math.min(width, height) * 0.16)
    g.fillStyle = look.color
    g.fill()
    g.lineWidth = Math.max(2, inset)
    g.strokeStyle = "rgba(0, 0, 0, 0.2)"
    g.stroke()
    if (look.label === "") return
    const size = fitSize(look.label, height * 0.5, width * 0.8, measure)
    g.font = `700 ${size}px ${font}`
    g.fillStyle = look.ink
    g.textAlign = "center"
    g.textBaseline = "middle"
    g.fillText(look.label, x0 + atlas.cellWidth / 2, y0 + atlas.cellHeight / 2 + size * 0.04)
  })
}

let ring: CanvasTexture | undefined

/** The ring of a space that can be chosen: the outline of a rounded plate, white, which the material tints */
function ringTexture(): CanvasTexture {
  if (ring) return ring
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 128
  const g = canvas.getContext("2d")!
  g.lineWidth = 9
  g.strokeStyle = "#ffffff"
  g.beginPath()
  g.roundRect(7, 7, 114, 114, 22)
  g.stroke()
  ring = new CanvasTexture(canvas)
  ring.colorSpace = SRGBColorSpace
  ring.anisotropy = 8
  return ring
}

/**
 * The spaces of a track, drawn as plates lying on the table: a label on each, a colour for the ones that matter (the start, the end, the spaces that pay), a ring on the ones that can be chosen, and a ring under the pointer on the one that
 * can be pressed. The plates are one mesh and one picture whatever their number, so a track of a hundred spaces costs no more than one of ten. The track draws no marker: a `TrackMarker` stands on a space and walks along the spaces.
 */
export function Track({ spaces, size, look, upright = true, halo = null, haloColor = RING, onSpace, onHover, font = TABLE_FONT, color = PLATE, ink = INK }: TrackProps) {
  // The spaces, the looks and the ring are kept as long as what they say is the same, so a game that makes them anew at each render does not make the track paint anew
  const spaceKey = JSON.stringify(spaces)
  const stable = useMemo(() => JSON.parse(spaceKey) as Space[], [spaceKey])
  const lookKey = JSON.stringify(
    stable.map((_, i): Look => {
      const given = look?.(i)
      return { label: given?.label ?? "", color: given?.color ?? color, ink: given?.ink ?? ink }
    }),
  )
  const looks = useMemo(() => JSON.parse(lookKey) as Look[], [lookKey])
  const haloKey = JSON.stringify(halo ?? [])
  const ringed = useMemo(() => (JSON.parse(haloKey) as number[]).filter((index) => Number.isInteger(index) && index >= 0 && index < stable.length), [haloKey, stable.length])

  const automatic = useMemo(() => plateSize(stable), [stable])
  const width = typeof size === "number" ? size : (size?.width ?? automatic.width)
  const depth = typeof size === "number" ? size : (size?.depth ?? automatic.depth)
  const plate = useMemo<PlateSize>(() => ({ width, depth }), [width, depth])
  const atlas = useMemo(() => atlasOf(stable.length, plate), [stable.length, plate])

  const geometry = useMemo(() => geometryOf(quadsOf(stable, plate, { height: PLATE_HEIGHT, upright, rect: (i) => cellRect(i, atlas) })), [stable, plate, upright, atlas])
  useEffect(() => () => geometry.dispose(), [geometry])
  const fontReady = useFontReady(font)
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas")
    canvas.width = atlas.width
    canvas.height = atlas.height
    paintPlates(canvas, atlas, looks, font)
    const map = new CanvasTexture(canvas)
    map.colorSpace = SRGBColorSpace
    map.anisotropy = 8
    return map
    // The font is a reason to paint again though the painting does not read it: the letters change when it has loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atlas, looks, font, fontReady])
  useEffect(() => () => texture.dispose(), [texture])

  // The rings: one mesh for all the spaces that can be chosen, which pulses, and one for the space under the pointer
  const [hovered, setHovered] = useState<number | null>(null)
  useCursor(hovered !== null && !!onSpace)
  const ringGeometry = useMemo(() => {
    const chosen = ringed.map((index) => stable[index]!)
    return chosen.length === 0 ? null : geometryOf(quadsOf(chosen, plate, { height: RING_HEIGHT, upright, grow: RING_GROW, rect: () => WHOLE }))
  }, [ringed, stable, plate, upright])
  useEffect(() => () => ringGeometry?.dispose(), [ringGeometry])
  const under = onSpace && hovered !== null && hovered < stable.length ? stable[hovered]! : null
  const underGeometry = useMemo(() => (under ? geometryOf(quadsOf([under], plate, { height: RING_HEIGHT, upright, grow: RING_GROW, rect: () => WHOLE })) : null), [under, plate, upright])
  useEffect(() => () => underGeometry?.dispose(), [underGeometry])
  const pulse = useRef<MeshBasicMaterial>(null)
  useFrame(({ clock }) => {
    if (pulse.current) pulse.current.opacity = 0.55 + 0.3 * Math.sin(clock.elapsedTime * 3.2)
  })

  const spaceAt = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    const index = spaceOfFace(e.faceIndex)
    return index >= 0 && index < stable.length ? index : -1
  }
  const interactive = !!onSpace || !!onHover
  if (stable.length === 0) return null
  return (
    <>
      <mesh
        geometry={geometry}
        renderOrder={-2}
        {...(interactive ? {} : { raycast: () => null })}
        onPointerMove={
          interactive
            ? (e) => {
                const index = spaceAt(e)
                if (index >= 0 && index !== hovered) {
                  setHovered(index)
                  onHover?.(index)
                }
              }
            : undefined
        }
        onPointerOut={
          interactive
            ? () => {
                if (hovered !== null) {
                  setHovered(null)
                  onHover?.(null)
                }
              }
            : undefined
        }
        onClick={
          onSpace
            ? (e) => {
                const index = spaceAt(e)
                if (index < 0) return
                e.stopPropagation()
                onSpace(index)
              }
            : undefined
        }
      >
        <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {ringGeometry && (
        <mesh geometry={ringGeometry} renderOrder={-1} raycast={() => null}>
          <meshBasicMaterial ref={pulse} map={ringTexture()} color={haloColor} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {underGeometry && (
        <mesh geometry={underGeometry} renderOrder={-1} raycast={() => null}>
          <meshBasicMaterial map={ringTexture()} color={haloColor} transparent opacity={0.95} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
    </>
  )
}
