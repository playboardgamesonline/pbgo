"use client"

import { type CameraSettings, paintFace, Piece, Stack } from "@pbgo/table"
import { PIECE_ROW, PAWN_AT, STACK_AT, TILE_AT } from "../defaults"
import { palette } from "./art"
import { Stage, TableLabel } from "./parts"

// Pieces on a table. The first row is every piece of the package, one of each shape, each pressed to be picked (it rises and a ring pulses round it). The second is a stack of discs whose count is a field of the game's state, a hexagonal tile that wears a picture
// on each face and hops over when it is turned, and a pawn that flies from one place to the other when it is sent across, the way a card does.

const CAMERA: CameraSettings = { tilt: 48, yaw: 0, distance: 11, fov: 34, targetX: 0, targetZ: 0.1 }

/** A picture for a face of the tile, painted in code: the colour of the face and a sign on it. */
function picture(kind: "top" | "bottom") {
  const colors = palette()
  return paintFace(
    `specimen-tile:${kind}`,
    { width: 1, height: 1 },
    (g, width, height) => {
      g.fillStyle = kind === "top" ? colors.marks[2] : colors.navy
      g.fillRect(0, 0, width, height)
      g.fillStyle = colors.ivory
      g.font = `700 ${width * 0.5}px system-ui, sans-serif`
      g.textAlign = "center"
      g.textBaseline = "middle"
      g.fillText(kind === "top" ? "7" : "?", width / 2, height / 2)
    },
    256,
  )
}

export function PiecesScene({ picked, ringed, stack, over, across, onPick }: { picked: string | null; ringed: boolean; stack: number; over: boolean; across: boolean; onPick: (id: string) => void }) {
  const colors = palette()
  const paints = [colors.marks[0], colors.marks[1], colors.marks[2], colors.ivory, colors.muted, colors.navy]
  return (
    <Stage id="scene-pieces" camera={CAMERA} playIntro={false}>
      {PIECE_ROW.map(({ id, shape, size, x }, i) => (
        <Piece
          key={id}
          id={id}
          model={shape}
          size={size}
          color={paints[i]}
          at={{ x, z: 1.1, yaw: 0.15 * (i % 2 ? -1 : 1) }}
          lift={picked === id ? 0.4 : 0}
          halo={picked === id || ringed ? colors.text : null}
          onClick={(event) => {
            event.stopPropagation()
            onPick(id)
          }}
        />
      ))}
      <TableLabel text="One of each shape: press one" x={0} z={2.1} height={0.45} tone="muted" />
      <Stack id="supply" count={stack} model="disc" size={0.8} color={colors.marks[2]} at={{ x: STACK_AT.x, z: STACK_AT.z }} />
      <TableLabel text="A stack" x={STACK_AT.x} z={STACK_AT.z + 0.9} height={0.4} tone="muted" />
      <Piece id="tile" model="hex" size={1.3} faces={{ top: picture("top"), bottom: picture("bottom") }} face={over ? "bottom" : "top"} at={{ x: TILE_AT.x, z: TILE_AT.z, yaw: 0.1 }} />
      <TableLabel text="A tile with two faces" x={TILE_AT.x} z={TILE_AT.z + 1.1} height={0.4} tone="muted" />
      <Piece id="traveller" model="pawn" size={0.7} color={colors.marks[0]} at={{ x: across ? PAWN_AT.far : PAWN_AT.near, z: PAWN_AT.z }} />
      <TableLabel text="A pawn that travels" x={(PAWN_AT.near + PAWN_AT.far) / 2} z={PAWN_AT.z + 0.9} height={0.4} tone="muted" />
    </Stage>
  )
}
