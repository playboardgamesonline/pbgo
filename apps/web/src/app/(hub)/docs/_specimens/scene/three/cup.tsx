"use client"

import { type CameraSettings, Cup, type CupPose, cupMouth, CUP_SIZE, DiceTray, Die } from "@pbgo/table"
import { palette } from "./art"
import { Stage, TableLabel } from "./parts"

// Two scenes with cups. The first is a hidden roll: three cups, each over five dice, yours in front and the other two at the sides. The cups shake and slam down; the scene is given the dice of the view, so the dice of the other two are not known to it until
// the engine reveals them (it draws a blank die under a cup it knows nothing about). You may peek at yours, which tilts your cup, and the cups lift when the dice are shown. The second is a cup that shakes the dice and pours them into a tray.

const CAMERA: CameraSettings = { tilt: 50, yaw: 0, distance: 15, fov: 34, targetX: 0, targetZ: 0.9 }
const SEATS = [
  { id: "you", at: { x: 0, z: 3.7, yaw: 0 }, label: "Your cup", labelAt: { x: 0, z: 6.0 } },
  { id: "left", at: { x: -4.9, z: -0.2, yaw: -Math.PI / 2 }, label: "Left seat", labelAt: { x: -4.9, z: 2.4 } },
  { id: "right", at: { x: 4.9, z: -0.2, yaw: Math.PI / 2 }, label: "Right seat", labelAt: { x: 4.9, z: 2.4 } },
] as const
const DIE = 0.4
/** Where the dice lie under a cup, in the frame of the cup: a ring of four and one in the middle */
const UNDER: readonly (readonly [number, number])[] = [
  [0, 0],
  [-0.46, -0.4],
  [0.46, -0.4],
  [-0.46, 0.4],
  [0.46, 0.4],
]

type Hand = readonly number[] | null

export function CupScene({
  yours,
  left,
  right,
  shaking,
  revealed,
  peek,
  dice,
  onPeek,
  onSlam,
}: {
  yours: readonly number[]
  left: Hand
  right: Hand
  shaking: boolean
  revealed: boolean
  peek: boolean
  /** The dice are on the table under the cups: they are in the cups' hands while the cups are shaken */
  dice: boolean
  onPeek: () => void
  onSlam: () => void
}) {
  const colors = palette()
  const paint = [colors.marks[0], colors.marks[1], colors.marks[2]]
  const hands: Hand[] = [yours, left, right]
  const poseOf = (id: string): CupPose => (shaking ? "shaking" : revealed ? "lifted" : id === "you" && peek ? "peeking" : "covering")
  return (
    <Stage id="scene-cup" camera={CAMERA} playIntro={false}>
      {SEATS.map(({ id, at, label, labelAt }, seat) => (
        <group key={id}>
          <Cup
            at={at}
            pose={poseOf(id)}
            color={paint[seat]}
            halo={id === "you" && !shaking && !revealed ? colors.text : null}
            onClick={
              id === "you"
                ? (event) => {
                    event.stopPropagation()
                    onPeek()
                  }
                : undefined
            }
            onReach={(pose) => pose === "covering" && onSlam()}
          />
          {dice &&
            UNDER.map(([ox, oz], k) => {
              const [sin, cos] = [Math.sin(at.yaw), Math.cos(at.yaw)]
              // The dice of a hand the view does not show are blank dice, as the board knows nothing of them: they are under a cup
              const value = hands[seat]?.[k] ?? 1
              return <Die key={`${id}-${k}`} id={`${id}-${k}`} value={value} at={{ x: at.x + ox * cos + oz * sin, z: at.z - ox * sin + oz * cos, yaw: k * 0.7 }} size={DIE} />
            })}
          <TableLabel text={label} x={labelAt.x} z={labelAt.z} height={0.4} tone="muted" />
        </group>
      ))}
    </Stage>
  )
}

const POUR_CAMERA: CameraSettings = { tilt: 52, yaw: 0, distance: 14.5, fov: 34, targetX: -0.4, targetZ: 0.6 }
/** The part of the table the dice are thrown onto, drawn under them: it is also the wall's */
const AREA = { x: 0.3, z: 0.5, width: 6, depth: 3.6 }
// The cup sits at the left of the tray, turned so that it pours toward it, and the mouth of a cup that is tipped over is above the tray: dice that start outside its wall would not get in
const POUR_AT = { x: -3.5, z: 0.5, yaw: -Math.PI / 2 }
const POUR_DIE = 0.5

export function PourScene({ values, rolls, pose, onPoured }: { values: readonly number[]; rolls: number; pose: CupPose; onPoured: () => void }) {
  const colors = palette()
  // The dice start from the mouth of the cup as it is tipped over, side by side across it, a little above one another
  const [mouthX, mouthY, mouthZ] = cupMouth(POUR_AT, "pouring", CUP_SIZE)
  return (
    <Stage id="scene-pour" camera={POUR_CAMERA} playIntro={false}>
      <mesh rotation-x={-Math.PI / 2} position={[AREA.x, 0.006, AREA.z]} renderOrder={1} raycast={() => null}>
        <planeGeometry args={[AREA.width, AREA.depth]} />
        <meshBasicMaterial color={colors.ink} transparent opacity={0.16} depthWrite={false} toneMapped={false} />
      </mesh>
      <DiceTray area={AREA}>
        {values.map((value, i) => (
          <Die
            key={i}
            id={`pour-${i}`}
            value={value}
            at={{ x: 0.3 + (i - (values.length - 1) / 2) * 1.1, z: 0.5 }}
            size={POUR_DIE}
            roll={rolls}
            from={[mouthX + (i - (values.length - 1) / 2) * 0.34, mouthY + i * 0.12, mouthZ]}
          />
        ))}
      </DiceTray>
      <Cup at={POUR_AT} pose={pose} color={colors.marks[2]} onReach={(reached) => reached === "pouring" && onPoured()} />
      <TableLabel text="Shake the cup, pour the dice" x={0.3} z={3.7} height={0.4} tone="muted" />
    </Stage>
  )
}
