"use client"

import { usePrefersReducedMotion } from "@pbgo/core/lib/use-motion"
import { useEffect, useRef, useState } from "react"
import { inOrder, type SequenceStep, stateAfter } from "./sequence"

export type SequenceOptions<S> = {
  /** Whether it plays: when it turns true the sequence starts from `start`, and while it is false the sequence is over and its state is null */
  active: boolean
  /** The state the table is in before anything has happened */
  start: S
  /** The state it ends in, which `skip` jumps to, and which a visitor who asks for less motion gets at once */
  final: S
  /** What happens and when: the milliseconds from the start and the part of the state that changes then. They may be written in any order */
  steps: readonly SequenceStep<S>[]
  /** Another value than the last one starts the sequence again: a game whose steps depend on something (how many piles there are) says what here */
  key?: string | number
}

export type Sequence<S> = {
  /** The state now: `start` and then what each step has changed, or null while the sequence is not active */
  state: S | null
  /** Jumps to the end state and cancels what is left to happen */
  skip: () => void
  /** Plays it again from its start */
  replay: () => void
  /** Holds it after the first `count` steps and nothing more happens until `replay`: for a debug panel that steps through it */
  hold: (count: number) => void
  /** How many steps it has */
  length: number
}

/**
 * A short film on the table made of states: while `active`, the state is `start` and each step changes a part of it at its moment, so a board draws the state it is given and the sequence is its clock. The end of a game that counts the families one by one, then
 * the piles, then goes dark and lights the winner is one; the opening of a game is another. It is not the engine's: nothing here is kept or sent, and a visitor who comes in late, or reloads, has the whole of it again.
 *
 * A visitor who asks for less motion gets the end state at once. `skip` ends it by hand, `replay` starts it again and `hold` stops it after a number of steps, which a debug panel uses to go through it step by step.
 */
export function useSequence<S>({ active, start, final, steps, key }: SequenceOptions<S>): Sequence<S> {
  const reduced = usePrefersReducedMotion()
  const [state, setState] = useState<S>(start)
  // Counts the plays: it goes up for each replay, and is negative while the sequence is held
  const [run, setRun] = useState(1)
  const latest = useRef({ start, final, steps })
  useEffect(() => {
    latest.current = { start, final, steps }
  })

  useEffect(() => {
    if (!active || run < 0) return
    const { start, final, steps } = latest.current
    // Always through a timer, never straight: the state is not set while the effect runs
    const timers = [setTimeout(() => setState(reduced ? final : start), 0)]
    if (!reduced) for (const [at, patch] of inOrder(steps)) timers.push(setTimeout(() => setState((now) => ({ ...now, ...patch })), at))
    return () => timers.forEach(clearTimeout)
  }, [active, run, key, reduced])

  // When it is not active it is over: back to its start, so that the next one does not begin with a flash of this one's end, and no longer held
  useEffect(() => {
    if (active) return
    const timer = setTimeout(() => {
      setState(latest.current.start)
      setRun((now) => Math.abs(now))
    }, 0)
    return () => clearTimeout(timer)
  }, [active])

  return {
    state: active ? state : null,
    skip: () => {
      setRun((now) => -Math.abs(now))
      setState(latest.current.final)
    },
    replay: () => setRun((now) => Math.abs(now) + 1),
    hold: (count) => {
      setRun((now) => -Math.abs(now))
      setState(stateAfter(latest.current.start, latest.current.steps, count))
    },
    length: steps.length,
  }
}
