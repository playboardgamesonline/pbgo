"use client"

import { Appear, Card, type CameraSettings, onTable, type SequenceStep, TableText, useSequence, VEIL, Veil } from "@pbgo/table"
import { useMemo } from "react"
import { back, CARD_SIZE, face } from "./art"
import { Stage } from "./parts"

// The end of a game, as a sequence of states: the points of each card come in one by one, then the table is put in the dark and the winner is lit. The scene draws the state it is given; the sequence is its clock.

const CAMERA: CameraSettings = { tilt: 50, yaw: 0, distance: 15, fov: 34, targetX: 0, targetZ: 0.1 }

/** The cards of the table, the points each one scores, and where it lies along the table. */
const CARDS = [
  { n: 5, points: 5, x: -4.5 },
  { n: 12, points: -2, x: -1.5 },
  { n: 21, points: 7, x: 1.5 },
  { n: 30, points: 3, x: 4.5 },
] as const

type Ending = { shown: number; veil: boolean; title: boolean }

const START: Ending = { shown: 0, veil: false, title: false }
const FINAL: Ending = { shown: CARDS.length, veil: true, title: true }

/** What happens when: a card's points every `seconds`, the dark once the last is in, then the title. */
function stepsFor(seconds: number): SequenceStep<Ending>[] {
  const ms = seconds * 1000
  return [...CARDS.map((_, i): SequenceStep<Ending> => [ms * (i + 1), { shown: i + 1 }]), [ms * (CARDS.length + 1), { veil: true }], [ms * (CARDS.length + 2), { title: true }]]
}

export type StagingKnobs = { run: number; seconds: number }

export function StagingScene({ run, seconds }: StagingKnobs) {
  const steps = useMemo(() => stepsFor(seconds), [seconds])
  // `run` starts it again, and so does the pace: a sequence is the same sequence only for the same steps
  const { state } = useSequence({ active: true, start: START, final: FINAL, steps, key: `${run}:${seconds}` })
  const ending = state ?? FINAL
  const cardBack = back()
  return (
    <Stage id="scene-staging" camera={CAMERA} playIntro={false}>
      {CARDS.map(({ n, x }) => (
        <Card key={n} target={onTable(x, 0.4)} front={face(n)} back={cardBack} size={CARD_SIZE} />
      ))}
      {CARDS.slice(0, ending.shown).map(({ n, points, x }) => (
        // each number comes down onto the table in front of its card as it is counted
        <Appear key={n} drop={1.5} duration={0.7}>
          <TableText
            text={points > 0 ? `+${points}` : `−${-points}`}
            style={{ color: points > 0 ? "#ffd35c" : "#ff8a8a", relief: "#1a1a1a", weight: 800, shadow: "rgba(0,0,0,0.5)|6|3" }}
            height={1}
            position={[x, 0.06, -1.9]}
          />
        </Appear>
      ))}
      <Veil active={ending.veil} opacity={0.62} color="#020b0d" />
      {ending.title && (
        // drawn after the veil, so that it is lit while the table is dark
        <Appear drop={1.2} duration={0.8}>
          <TableText text="Ada wins" style={{ color: "#fff4dc", relief: "#8a6a3a", weight: 800, shadow: "rgba(0,0,0,0.4)|10|4" }} height={1.6} position={[0, 0.4, 2.6]} layer={VEIL.order + 1} />
        </Appear>
      )}
    </Stage>
  )
}
