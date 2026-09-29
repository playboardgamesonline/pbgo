"use client"

import type { PlayerView } from "@courtisans/engine"
import { button, useControls } from "leva"
import { useEffect, useState } from "react"

export type EndingState = {
  tableSpies: "cache" | "flip" | "sort"
  families: number
  domains: boolean
  pile: number
  missions: boolean
  black: boolean
  spotlight: boolean
  text: boolean
  scoreboard: boolean
}

export const TABLE_FAMILY_COUNT = 6

const START: EndingState = {
  tableSpies: "cache",
  families: 0,
  domains: false,
  pile: 0,
  missions: false,
  black: false,
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
  black: true,
  spotlight: true,
  text: true,
  scoreboard: true,
}

function schedule(piles: number): [number, Partial<EndingState>][] {
  const steps: [number, Partial<EndingState>][] = [
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
  steps.push([t + 1800, { black: true }])
  steps.push([t + 3000, { spotlight: true }])
  steps.push([t + 4000, { text: true }])
  steps.push([t + 8500, { scoreboard: true }])
  return steps
}

export function useEndingSequence(view: PlayerView) {
  const active = view.phase === "over" && !!view.results
  const piles = Math.max(0, ...(view.results?.players.map((j) => j.families.length) ?? [0]))
  const [makeState, setEndingState] = useState<EndingState>(START)
  const [playback, setPlayback] = useState(0)
  const steps = schedule(piles)

  useEffect(() => {
    if (!active || playback < 0) return
    const timers = [setTimeout(() => setEndingState(START), 0)]
    for (const [t, update] of schedule(piles)) timers.push(setTimeout(() => setEndingState((e) => (e.scoreboard ? e : { ...e, ...update })), t))
    return () => timers.forEach(clearTimeout)
  }, [active, piles, playback])

  useControls(
    "End Sequence",
    {
      Replay: button(() => setPlayback((l) => Math.abs(l) + 1)),
      openingStep: {
        label: "step",
        value: 0,
        min: 0,
        max: steps.length,
        step: 1,
        onChange: (n: number, _chemin: string, ctx: { initial: boolean }) => {
          if (ctx.initial) return
          setPlayback((l) => -Math.abs(l) - 1)
          setEndingState(steps.slice(0, n).reduce<EndingState>((e, [, update]) => ({ ...e, ...update }), START))
        },
      },
    },
    { render: () => active },
    [active, steps.length],
  )

  return { ending: active ? makeState : null, skip: () => setEndingState(FINAL) }
}
