"use client"

import { useEffect, useMemo } from "react"
import { BufferGeometry, DoubleSide, EdgesGeometry, PlaneGeometry, Vector3 } from "three"
import type { CardSize } from "../card/geometry"
import { inFrame, type Spot } from "../layout"
import type { Pose } from "../pose"
import type { Plate } from "../seat/placement"

/** The helpers the debug panel draws over the table: lines and marks, drawn over the cards (no depth test, a late render order), that take no click */

/** Drawn after the cards, which sit at render order 0 and 20 */
const ORDER = 100
/** A hair above the table, so a mark lies on it without fighting its surface */
const LIFT = 0.05
const ZONE = "#59d4ff"
const SEAT = "#ffb347"
const noClick = () => null

/** The three axes at the middle of the table: x to the right (red), y up (green), z toward the viewer (blue) */
export function AxesGizmo() {
  return <axesHelper args={[2]} position={[0, LIFT, 0]} renderOrder={ORDER} raycast={noClick} />
}

/**
 * Where a zone is: its frame (the axes at the spot it is laid in, turned the way it faces) and its slots, each the outline of a card lying in it, in the order the cards take them.
 * Drawn from the layout, so a slot with no card in it shows too.
 */
export function ZoneGizmo({ frame, layout, size }: { frame?: Spot; layout: readonly Pose[]; size: CardSize }) {
  const outline = useMemo(() => new EdgesGeometry(new PlaneGeometry(size.width, size.height)), [size.width, size.height])
  useEffect(() => () => outline.dispose(), [outline])
  return (
    <group renderOrder={ORDER}>
      {frame && <axesHelper args={[0.8]} position={[frame.x, LIFT, frame.z]} rotation-y={frame.yaw ?? 0} raycast={noClick} />}
      {layout.map((pose, i) => {
        const slot = frame ? inFrame(frame, pose) : pose
        return (
          <lineSegments key={i} geometry={outline} position={slot.position} quaternion={slot.quaternion} scale={slot.scale} raycast={noClick}>
            <lineBasicMaterial color={ZONE} depthTest={false} transparent />
          </lineSegments>
        )
      })}
    </group>
  )
}

/** Where a seat is: the spot the ring gives it (axes, turned the way it faces), the middle of its plate (a ring) and the line from one to the other */
export function SeatGizmo({ spot, plate }: { spot: Spot; plate: Plate }) {
  const link = useMemo(() => new BufferGeometry().setFromPoints([new Vector3(spot.x, LIFT, spot.z), new Vector3(plate.x, LIFT, plate.z)]), [spot.x, spot.z, plate.x, plate.z])
  useEffect(() => () => link.dispose(), [link])
  return (
    <group renderOrder={ORDER}>
      <axesHelper args={[0.6]} position={[spot.x, LIFT, spot.z]} rotation-y={spot.yaw ?? 0} raycast={noClick} />
      <mesh position={[plate.x, LIFT, plate.z]} rotation-x={-Math.PI / 2} raycast={noClick}>
        <ringGeometry args={[0.18, 0.24, 24]} />
        <meshBasicMaterial color={SEAT} depthTest={false} transparent side={DoubleSide} />
      </mesh>
      <lineSegments geometry={link} raycast={noClick}>
        <lineBasicMaterial color={SEAT} depthTest={false} transparent />
      </lineSegments>
    </group>
  )
}
