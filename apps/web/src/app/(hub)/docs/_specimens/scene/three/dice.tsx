"use client"

import { type CameraSettings, DiceTray, Die, DIE_SETTINGS } from "@pbgo/table"
import { useEffect, useRef } from "react"
import type { DiceKnobs, DiceShape } from "../defaults"
import { palette } from "./art"
import { Stage } from "./parts"

// Dice thrown onto a table. The engine's side is the `values` and `rolls` props: the number each die ends on, and a count that goes up with every roll, which is what throws the dice. The dice are in a `DiceTray`, so they meet and knock one
// another, and a wall keeps them in the area drawn under them. The three knobs are fields of `DIE_SETTINGS`, the one object every die of the page reads: the scene writes the sliders into it while it is on the page and puts back what it found when it
// leaves. It does not know the starting values: it reads them and tells the controls (`onDefaults`).

const CAMERA: CameraSettings = { tilt: 50, yaw: 0, distance: 10, fov: 34, targetX: 0, targetZ: 0.3 }
/** The table seen from straight above, where the face that lies up is the one that faces the viewer. */
const ABOVE: CameraSettings = { tilt: 6, yaw: 0, distance: 9, fov: 34, targetX: 0, targetZ: 0.2 }

/** Where the dice are thrown: the area drawn on the table, which is also the wall's. */
const AREA = { x: 0, z: 0.2, width: 6.4, depth: 3.8 }

/** The edge of the dice of the specimen, and how far apart they lie before the first roll. */
const SIZE = 0.8
const GAP = 1.4

export function DiceScene({
  shape,
  count,
  above,
  values,
  rolls,
  knobs,
  onDefaults,
}: {
  shape: DiceShape
  count: number
  above: boolean
  values: readonly number[]
  rolls: number
  knobs: DiceKnobs | null
  onDefaults: (found: DiceKnobs) => void
}) {
  const latest = useRef({ knobs, onDefaults })
  useEffect(() => {
    latest.current = { knobs, onDefaults }
  })
  useEffect(() => {
    const found: DiceKnobs = { restitution: DIE_SETTINGS.restitution, throwSpeed: DIE_SETTINGS.throwSpeed, speed: DIE_SETTINGS.speed }
    if (latest.current.knobs === null) latest.current.onDefaults(found)
    return () => {
      Object.assign(DIE_SETTINGS, found)
    }
  }, [])
  useEffect(() => {
    if (knobs) Object.assign(DIE_SETTINGS, knobs)
  }, [knobs])

  return (
    <Stage id="scene-dice" camera={above ? ABOVE : CAMERA} playIntro={false}>
      <mesh rotation-x={-Math.PI / 2} position={[AREA.x, 0.006, AREA.z]} renderOrder={1} raycast={() => null}>
        <planeGeometry args={[AREA.width, AREA.depth]} />
        <meshBasicMaterial color={palette().ink} transparent opacity={0.16} depthWrite={false} toneMapped={false} />
      </mesh>
      <DiceTray area={AREA}>
        {Array.from({ length: count }, (_, i) => (
          <Die key={`${shape}-${i}`} id={`die-${i}`} model={shape} size={SIZE} value={values[i] ?? 1} roll={rolls === 0 ? undefined : rolls} at={{ x: (i - (count - 1) / 2) * GAP, z: AREA.z }} />
        ))}
      </DiceTray>
    </Stage>
  )
}
