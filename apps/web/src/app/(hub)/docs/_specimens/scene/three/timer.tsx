"use client"

import { type CameraSettings, Timer } from "@pbgo/table"
import { TIMER_REST } from "../defaults"
import { Stage, TableLabel } from "./parts"

// Four hourglasses. The big one has a clock: it is given when the time of the step ends, which the platform counts, and how long the step is, which the game says, and it runs, turns over when a new step starts and warns in the last seconds. The three small
// ones have no clock: each shows what it is told is left of the time and waits.

const CAMERA: CameraSettings = { tilt: 46, yaw: 0, distance: 15.5, fov: 34, targetX: 0.2, targetZ: -0.4 }
const BIG = { x: -3.7, z: -0.7, size: 3.2 }
const SMALL = { x: 0.9, gap: 2.4, z: -0.3, size: 1.9 }

export function TimerScene({ endsAt, seconds, rest, digits, onEnd }: { endsAt: number | null; seconds: number; rest: number; digits: boolean; onEnd: () => void }) {
  return (
    <Stage id="scene-timer" camera={CAMERA} playIntro={false}>
      <Timer endsAt={endsAt} seconds={seconds} rest={rest} at={{ x: BIG.x, z: BIG.z }} size={BIG.size} digits={digits} onEnd={onEnd} />
      <TableLabel text="With a clock" x={BIG.x} z={3.3} height={0.4} tone="muted" />
      {TIMER_REST.map((left, i) => (
        <Timer key={left} endsAt={null} seconds={seconds} rest={left} at={{ x: SMALL.x + i * SMALL.gap, z: SMALL.z }} size={SMALL.size} digits={false} />
      ))}
      <TableLabel text="With no clock: what is left" x={SMALL.x + SMALL.gap} z={1.9} height={0.4} tone="muted" />
    </Stage>
  )
}
