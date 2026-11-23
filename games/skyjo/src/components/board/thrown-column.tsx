"use client"

import { ease } from "@pbgo/core/components/game/easing"
import { playSound } from "@pbgo/core/lib/sound"
import { CARD_SETTINGS, flightCues, type SequenceStep, useSequence, Zone, type ZoneCard } from "@pbgo/table"
import { useEffect, useMemo, useState } from "react"
import type { Texture } from "three"
import { type Landing, stackAt, type StackPlan, stackPlan } from "./columns"
import type { SeatLayout } from "./layout"
import { CARD_SIZE } from "./textures"

export type ThrownColumnProps = {
  /** The seat the column was thrown away from, the number of the column, and the columns the grid laid out while it formed (the column is one of them) */
  seat: SeatLayout
  column: number
  shown: readonly number[]
  /** Where the stack lands: the discard */
  landing: Landing
  /** The three cards of the column by row, the first row on top: the number each has at the table (`id`) and its face */
  cards: readonly { id: number; front: Texture }[]
  back: Texture
  /** The stack is on its way to the discard. False while the three cards are still sliding together into it: the stack is made, and waits */
  travelling: boolean
  /** Seconds the flight takes */
  seconds: number
}

/** How many times in a second the stack is moved on its way: the cards glide to where it is each time, so it moves as one thing and smoothly */
const RATE = 30

/** How quickly the cards of the stack follow it as it flies, in seconds to settle (a card's own is 0.16): fast, so that the three stay one stack */
const FOLLOW = 0.05

/** The share of the flight in which the stack goes along its path: the cards that follow it are a little behind and settle on the discard in the rest */
const ARRIVE = 0.8

/** The moves of the stack: which of the `legs` of its way it is on, from 0 at its start to `legs` at the discard */
type Way = { leg: number }

/**
 * The three cards of a column thrown away, from the moment they leave the grid to the moment they land on the discard: they slide together into one stack where the column stood (each card glides to its slot of the stack as it does to any slot, from where it lay), and then
 * the stack flies to the discard as one. A card that flies by itself arches and turns to a side of its own, so three of them would not stay a stack: the stack is moved along its path in small steps (a sequence of the table kit, `stackAt` for the poses), and each card glides
 * to the place it is given, quickly, so the three keep together. When it lands the cards are handed to the discard, which starts them where the stack left them (the table remembers where a card was, `Card`).
 *
 * The stack is planned once, when it forms, and the grid that closes over the gap does not move it. A visitor who asks for less motion never sees it (the board plays no column for them).
 */
export function ThrownColumn({ seat, column, shown, landing, cards, back, travelling, seconds }: ThrownColumnProps) {
  const [plan] = useState<StackPlan>(() => stackPlan(seat, column, shown, landing))
  const legs = Math.max(2, Math.round(seconds * RATE))
  const steps = useMemo(() => Array.from({ length: legs + 1 }, (_, leg): SequenceStep<Way> => [Math.round((leg * seconds * 1000 * ARRIVE) / legs), { leg }]), [legs, seconds])
  const { state } = useSequence<Way>({ active: travelling, start: { leg: 0 }, final: { leg: legs }, steps })
  const leg = state?.leg ?? 0
  // the poses of the three cards where the stack is now: the easing and the height are those of a card's flight
  const poses = useMemo(() => stackAt(plan, ease(CARD_SETTINGS.easing, leg / legs)), [plan, leg, legs])

  // A card that flies makes a sound as it sets out and another as it lands, for a game that declares them: so does the stack
  useEffect(() => {
    if (!travelling) return
    for (const cue of flightCues(0, seconds)) playSound(cue.name, { delay: cue.delay, optional: true })
  }, [travelling, seconds])

  return <Zone layout={poses} size={CARD_SIZE} cards={cards.map((card): ZoneCard => ({ key: `c-${card.id}`, id: card.id, front: card.front, back, ...(travelling ? { speed: FOLLOW } : {}) }))} />
}
