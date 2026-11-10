"use client"

import { useCursor } from "@react-three/drei"
import { type ThreeEvent, useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef, useState } from "react"
import { BufferAttribute, BufferGeometry, CanvasTexture, Color, type MeshBasicMaterial, SRGBColorSpace } from "three"
import { useDragState } from "../drag/context"
import { useDropZones } from "../drag/drop-zone"
import { cellShape } from "../drag/shapes"
import type { ZoneId } from "../drag/store"
import { useFontReady } from "../font"
import { TABLE_FONT } from "../seat/table-text"
import { type Atlas, atlasOf, cellRect, fitSize, quadsOf } from "../track/atlas"
import { type BoardCell, inradius } from "./cells"
import { cellColors, cellOfFace, plateMesh, ringMesh } from "./mesh"

/** What a cell shows: its colour, and the label written in the middle of it with the colour of its ink. A field left out is the board's own */
export type CellLook = { color?: string; label?: string; ink?: string }

export type BoardProps = {
  /** The cells, placed on the table: `squareCells` or `hexCells` make them from the `coords` of the engine's board, and the number of a cell is its place in the list. Keep the list from one render to the next, or compute it in `useMemo` */
  cells: readonly BoardCell[]
  /** What each cell shows: its colour (the two colours of a chessboard, the owner of a territory, a cell that was just played), and a label. Called for every cell whenever the board is drawn, so it comes from the game's state and the visitor's language */
  look?: (index: number) => CellLook
  /** The colour of the cells and of the ink of the labels that give none */
  color?: string
  ink?: string
  /** The numbers of the cells that can be chosen: a ring pulses on each. None when null */
  halo?: readonly number[] | null
  /** The numbers of the cells that things can be let go on: a cell is a zone, named by its number unless `dropId` says otherwise, so the `dropOn` of a piece lists numbers. While a piece is held that may go on them a ring pulses on each, and the one it is over takes the ring of the pointer. None when null */
  drops?: readonly number[] | null
  /** The name of the zone of a cell, from its number (default the number itself). A table with more than one board gives each its own, such as `${seat}:${cell}`, so that a cell of one board is never taken for a cell of another */
  dropId?: (index: number) => ZoneId
  /** The colour of the ring, and of the ring under the pointer */
  haloColor?: string
  /** Pressing a cell does this, with its number. Without it the cells only show. The cell under the pointer takes a ring */
  onCell?: (index: number) => void
  /** The pointer comes onto a cell, with its number, and leaves it, with null */
  onHover?: (index: number | null) => void
  /** The CSS font of the labels, `TABLE_FONT` by default */
  font?: string
}

const CELL = "#e3d8bd"
const INK = "#2b261f"
// A ring is drawn inside the edge of a cell, on the colour of the cell: a vivid colour that shows on light cells and on dark ones
const RING = "#ff5a36"
// How high above the table the cells, their labels and their rings lie: over the surface and under the shadows of the pieces, which lie at 0.012
const PLATE_HEIGHT = 0.004
const LABEL_HEIGHT = 0.006
const RING_HEIGHT = 0.009
// How far in from the edge of a cell its ring goes, as a part of the way to its middle
const RING_THICKNESS = 0.18

/** What a cell is painted from: every field is there, the board's own filling in for the ones the game left out */
type Look = { color: string; label: string; ink: string }

function geometryOf(positions: Float32Array, indices: Uint32Array, colours?: Float32Array): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute("position", new BufferAttribute(positions, 3))
  if (colours) geometry.setAttribute("color", new BufferAttribute(colours, 3))
  geometry.setIndex(new BufferAttribute(indices, 1))
  return geometry
}

/** Paints the labels, one in each cell of the atlas, in the ink of its cell and letters that shrink to fit */
function paintLabels(canvas: HTMLCanvasElement, atlas: Atlas, labels: readonly { text: string; ink: string }[], font: string): void {
  const g = canvas.getContext("2d")
  if (!g) return
  g.clearRect(0, 0, canvas.width, canvas.height)
  const measure = (text: string, size: number) => {
    g.font = `700 ${size}px ${font}`
    return g.measureText(text).width
  }
  g.textAlign = "center"
  g.textBaseline = "middle"
  labels.forEach(({ text, ink }, i) => {
    const size = fitSize(text, atlas.cellHeight * 0.5, atlas.cellWidth * 0.9, measure)
    g.font = `700 ${size}px ${font}`
    g.fillStyle = ink
    g.fillText(text, (i % atlas.columns) * atlas.cellWidth + atlas.cellWidth / 2, Math.floor(i / atlas.columns) * atlas.cellHeight + atlas.cellHeight / 2 + size * 0.04)
  })
}

/**
 * The cells of a board, drawn as plates lying on the table: square or hexagonal, any colour, a label on the ones that have one, a ring on the ones that can be chosen and a ring under the pointer on the one that can be pressed. The cells are one mesh
 * whatever their number, and their colours are those of its vertices, so a board that changes colour at every move is not painted again. The board draws no piece: a `Piece` stands on a cell with `at={cells[i]}`, and a `TrackMarker` walks across the cells.
 */
export function Board({ cells, look, color = CELL, ink = INK, halo = null, drops = null, dropId, haloColor = RING, onCell, onHover, font = TABLE_FONT }: BoardProps) {
  // The cells, the looks and the ring are kept as long as what they say is the same, so a game that makes them anew at each render does not make the board paint anew
  const cellsKey = JSON.stringify(cells)
  const stable = useMemo(() => JSON.parse(cellsKey) as BoardCell[], [cellsKey])
  const lookKey = JSON.stringify(
    stable.map((_, i): Look => {
      const given = look?.(i)
      return { color: given?.color ?? color, label: given?.label ?? "", ink: given?.ink ?? ink }
    }),
  )
  const looks = useMemo(() => JSON.parse(lookKey) as Look[], [lookKey])
  const haloKey = JSON.stringify(halo ?? [])
  const haloed = useMemo(() => (JSON.parse(haloKey) as number[]).filter((index) => Number.isInteger(index) && index >= 0 && index < stable.length), [haloKey, stable.length])

  // The cells that things can be let go on are zones of the table; while something is held that may go on them they are ringed, and the one it is over takes the ring of the pointer
  const dropKey = JSON.stringify(drops ?? [])
  const droppable = useMemo(() => (JSON.parse(dropKey) as number[]).filter((index) => Number.isInteger(index) && index >= 0 && index < stable.length), [dropKey, stable.length])
  const zoneOf = (index: number): ZoneId => (dropId ? dropId(index) : index)
  useDropZones(useMemo(() => droppable.map((index) => ({ id: dropId ? dropId(index) : index, shape: cellShape(stable[index]!) })), [droppable, stable, dropId]))
  const drag = useDragState()
  const ringed = useMemo(() => {
    const open = drag.dragging ? droppable.filter((index) => !drag.legal || drag.legal.includes(dropId ? dropId(index) : index)) : []
    return open.length === 0 ? haloed : [...new Set([...haloed, ...open])]
  }, [haloed, droppable, drag.dragging, drag.legal, dropId])

  const plates = useMemo(() => plateMesh(stable, PLATE_HEIGHT), [stable])
  const colours = useMemo(
    () =>
      cellColors(
        plates.vertexStarts,
        looks.map((one) => {
          const rgb = new Color(one.color)
          return [rgb.r, rgb.g, rgb.b] as const
        }),
      ),
    [plates, looks],
  )
  const geometry = useMemo(() => geometryOf(plates.positions, plates.indices, colours), [plates, colours])
  useEffect(() => () => geometry.dispose(), [geometry])

  // The labels: one picture for the cells that have one, and a square over each of them
  const fontReady = useFontReady(font)
  const labelled = useMemo(() => looks.flatMap((one, index) => (one.label === "" ? [] : [index])), [looks])
  const labelPlate = useMemo(() => {
    // The room a label has: a square a little smaller than the circle that fits in the cell
    const room = labelled.length === 0 ? 1 : Math.min(...labelled.map((index) => inradius(stable[index]!))) * 1.7
    return { width: room, depth: room }
  }, [labelled, stable])
  const labelAtlas = useMemo(() => atlasOf(labelled.length, labelPlate), [labelled.length, labelPlate])
  const labelTexture = useMemo(() => {
    if (labelled.length === 0) return null
    const canvas = document.createElement("canvas")
    canvas.width = labelAtlas.width
    canvas.height = labelAtlas.height
    paintLabels(
      canvas,
      labelAtlas,
      labelled.map((index) => ({ text: looks[index]!.label, ink: looks[index]!.ink })),
      font,
    )
    const map = new CanvasTexture(canvas)
    map.colorSpace = SRGBColorSpace
    map.anisotropy = 8
    return map
    // The font is a reason to paint again though the painting does not read it: the letters change when it has loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelled, labelAtlas, looks, font, fontReady])
  useEffect(() => () => labelTexture?.dispose(), [labelTexture])
  const labelGeometry = useMemo(() => {
    if (labelled.length === 0) return null
    const { positions, uvs, indices } = quadsOf(
      labelled.map((index) => stable[index]!),
      labelPlate,
      { height: LABEL_HEIGHT, upright: true, rect: (j) => cellRect(j, labelAtlas) },
    )
    const quads = geometryOf(positions, indices)
    quads.setAttribute("uv", new BufferAttribute(uvs, 2))
    return quads
  }, [labelled, stable, labelPlate, labelAtlas])
  useEffect(() => () => labelGeometry?.dispose(), [labelGeometry])

  // The rings: one mesh for all the cells that can be chosen, which pulses, and one for the cell under the pointer
  const [hovered, setHovered] = useState<number | null>(null)
  useCursor(hovered !== null && !!onCell)
  const ringGeometry = useMemo(() => {
    if (ringed.length === 0) return null
    const { positions, indices } = ringMesh(
      ringed.map((index) => stable[index]!),
      RING_HEIGHT,
      RING_THICKNESS,
    )
    return geometryOf(positions, indices)
  }, [ringed, stable])
  useEffect(() => () => ringGeometry?.dispose(), [ringGeometry])
  // The cell under a held piece, or else the one under the pointer when the cells can be pressed
  const heldOver = drag.over === null ? null : (droppable.find((index) => zoneOf(index) === drag.over) ?? null)
  const underIndex = heldOver ?? (onCell && hovered !== null && hovered < stable.length ? hovered : null)
  const under = underIndex !== null ? stable[underIndex]! : null
  const underGeometry = useMemo(() => {
    if (!under) return null
    const { positions, indices } = ringMesh([under], RING_HEIGHT, RING_THICKNESS)
    return geometryOf(positions, indices)
  }, [under])
  useEffect(() => () => underGeometry?.dispose(), [underGeometry])
  const pulse = useRef<MeshBasicMaterial>(null)
  useFrame(({ clock }) => {
    if (pulse.current) pulse.current.opacity = 0.55 + 0.3 * Math.sin(clock.elapsedTime * 3.2)
  })

  const cellAt = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    const index = cellOfFace(e.faceIndex, plates.triangleStarts)
    return index >= 0 && index < stable.length ? index : -1
  }
  const interactive = !!onCell || !!onHover
  if (stable.length === 0) return null
  return (
    <>
      <mesh
        geometry={geometry}
        {...(interactive ? {} : { raycast: () => null })}
        onPointerMove={
          interactive
            ? (e) => {
                const index = cellAt(e)
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
          onCell
            ? (e) => {
                const index = cellAt(e)
                if (index < 0) return
                e.stopPropagation()
                onCell(index)
              }
            : undefined
        }
      >
        <meshBasicMaterial vertexColors toneMapped={false} />
      </mesh>
      {labelGeometry && labelTexture && (
        <mesh geometry={labelGeometry} renderOrder={-2} raycast={() => null}>
          <meshBasicMaterial map={labelTexture} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {ringGeometry && (
        <mesh geometry={ringGeometry} renderOrder={-1} raycast={() => null}>
          <meshBasicMaterial ref={pulse} color={haloColor} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {underGeometry && (
        <mesh geometry={underGeometry} renderOrder={-1} raycast={() => null}>
          <meshBasicMaterial color={haloColor} transparent opacity={0.95} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
    </>
  )
}
