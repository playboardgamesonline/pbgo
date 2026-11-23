"use client"

import type { PlayerView } from "@courtisans/engine"
import { button, useControls } from "@pbgo/core/components/game/debug-controls"
import { type SequenceStep, useSequence } from "@pbgo/table"

/** What the table shows of the end of the game, step by step: the state of a sequence, which the board draws */
export type EndingState = {
  /** The spies played on the Queen's table: face down, turned over where they lie, then sorted into their own columns */
  tableSpies: "cache" | "flip" | "sort"
  /** How many families of the mat have been settled so far, left to right: the arrow and the line of each */
  families: number
  /** The spies of the domains have shown their family and the piles are regrouped */
  domains: boolean
  /** How many piles of each domain have been counted so far */
  pile: number
  /** The missions of every player are shown, with their sign */
  missions: boolean
  /** The aura of the winners */
  spotlight: boolean
  /** The victory announcement, and the button to skip */
  text: boolean
  /** The score table: the sequence is over */
  scoreboard: boolean
}

export const TABLE_FAMILY_COUNT = 6

const START: EndingState = {
  tableSpies: "cache",
  families: 0,
  domains: false,
  pile: 0,
  missions: false,
  spotlight: false,
  text: false,
  scoreboard: false,
}

const FINAL: EndingState = {
  tableSpies: "sort",
  families: TABLE_FAMILY_COUNT,
  domains: true,
  pile: 99,
  missions: true,
  spotlight: true,
  text: true,
  scoreboard: true,
}

/** The moments of the end, in milliseconds from the moment the game is over, for a table whose players have `piles` piles at the most */
export function endingSteps(piles: number): SequenceStep<EndingState>[] {
  const steps: SequenceStep<EndingState>[] = [
    [900, { tableSpies: "flip" }],
    [2100, { tableSpies: "sort" }],
  ]
  for (let i = 1; i <= TABLE_FAMILY_COUNT; i++) steps.push([2200 + i * 950, { families: i }])
  let t = 2200 + TABLE_FAMILY_COUNT * 950 + 1300
  steps.push([t, { domains: true }])
  t += 1500
  for (let p = 1; p <= piles; p++) steps.push([t + (p - 1) * 750, { pile: p }])
  t += piles * 750 + 400
  steps.push([t, { missions: true }])
  steps.push([t + 3000, { spotlight: true }])
  steps.push([t + 4000, { text: true }])
  steps.push([t + 8500, { scoreboard: true }])
  return steps
}

/** The end of the game as a sequence: the state it is in now (null while the game is on) and how to skip it. A visitor who asks for less motion gets the end at once */
export function useEndingSequence(view: PlayerView) {
  const active = view.phase === "over" && !!view.results
  const piles = Math.max(0, ...(view.results?.players.map((j) => j.families.length) ?? [0]))
  const sequence = useSequence<EndingState>({ active, start: START, final: FINAL, steps: endingSteps(piles), key: piles })

  useControls(
    "End Sequence",
    {
      Replay: button(sequence.replay),
      openingStep: {
        label: "step",
        value: 0,
        min: 0,
        max: sequence.length,
        step: 1,
        onChange: (n: number, _path: string, context: { initial: boolean }) => {
          if (!context.initial) sequence.hold(n)
        },
      },
    },
    { render: () => active },
    [active, sequence.length],
  )

  return { ending: sequence.state, skip: sequence.skip }
}
