"use client"

import { type CameraSettings, seats, type Spot } from "@pbgo/table"
import { label, palette } from "./art"
import { Stage } from "./parts"

// The ring `seats` gives, drawn as it is: one spot for each player on an ellipse, indexed like the players. Each seat is a disc with its number (upright for the viewer) and an arrow along the frame of the spot, the way a layout drawn in it
// points: the top edge of a face-up card. The viewer's seat is the one in front with a yaw of zero; the others follow around the far half, the turn passing to the left. Without a viewer (a spectator) everyone sits on the far half.

const CAMERA: CameraSettings = { tilt: 44, yaw: 0, distance: 20, fov: 34, targetX: 0, targetZ: 0.9 }

const RING = { radiusX: 7.4, radiusZ: 4.4 }

/** The disc of a seat, and how far from its middle its arrow stands. */
const DISC = 0.72
const ARROW = { reach: 1.2, size: 0.42 }

function Seat({ spot, index, you }: { spot: Required<Spot>; index: number; you: boolean }) {
  const p = palette()
  const number = label(String(index + 1), you ? "ink" : "text")
  return (
    <>
      {/* The frame of the seat: what is drawn in it turns with its yaw */}
      <group position={[spot.x, 0, spot.z]} rotation-y={spot.yaw}>
        <mesh position-y={0.02} rotation-x={-Math.PI / 2} raycast={() => null}>
          <circleGeometry args={[DISC, 48]} />
          <meshBasicMaterial color={you ? p.ivory : p.navy} toneMapped={false} />
        </mesh>
        {/* A triangle whose point is toward -z of the frame, the top edge of a face-up card */}
        <mesh position={[0, 0.03, -ARROW.reach]} rotation-x={-Math.PI / 2} raycast={() => null}>
          <circleGeometry args={[ARROW.size, 3, Math.PI / 2]} />
          <meshBasicMaterial color={p.marks[2]} toneMapped={false} />
        </mesh>
      </group>
      <mesh position={[spot.x, 0.05, spot.z]} rotation-x={-Math.PI / 2} renderOrder={5} raycast={() => null}>
        <planeGeometry args={[DISC * 0.9 * number.aspect, DISC * 0.9]} />
        <meshBasicMaterial map={number.texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  )
}

export function SeatsScene({ count, me }: { count: number; me: number | null }) {
  const ring = seats(count, { ...RING, me })
  return (
    <Stage id="scene-seats" camera={CAMERA} playIntro={false}>
      {ring.map((spot, i) => (
        <Seat key={i} spot={spot} index={i} you={i === me} />
      ))}
    </Stage>
  )
}
