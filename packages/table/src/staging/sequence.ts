// The pure half of a sequence, a short film on the table made of states: the state a board starts in and the parts of it that change, one step at a time, at the moments a game says. The end of a game is one (the families are counted one by one, then the piles, then the
// table goes dark and the winner is lit), the opening of a game is another. No React: `use-sequence.ts` plays it and `sequence.test.ts` holds this.

/** What happens at a moment of a sequence: the milliseconds from its start, and the part of the state that changes then */
export type SequenceStep<S> = readonly [at: number, patch: Partial<S>]

/** The steps in the order they happen: by time, and two at the same time in the order they were given in. A game may write them in any order */
export function inOrder<S>(steps: readonly SequenceStep<S>[]): SequenceStep<S>[] {
  return steps
    .map((step, i) => [step, i] as const)
    .sort(([a, i], [b, j]) => a[0] - b[0] || i - j)
    .map(([step]) => step)
}

/** The state after the first `count` steps, in the order they happen, have happened */
export function stateAfter<S>(start: S, steps: readonly SequenceStep<S>[], count: number): S {
  return inOrder(steps)
    .slice(0, Math.max(0, count))
    .reduce<S>((state, [, patch]) => ({ ...state, ...patch }), start)
}

/** The state `ms` milliseconds into the sequence: every step at or before that moment has happened */
export function stateAt<S>(start: S, steps: readonly SequenceStep<S>[], ms: number): S {
  return inOrder(steps)
    .filter(([at]) => at <= ms)
    .reduce<S>((state, [, patch]) => ({ ...state, ...patch }), start)
}

/** When the last step happens, in milliseconds from the start: 0 for a sequence with no step */
export function sequenceEnd<S>(steps: readonly SequenceStep<S>[]): number {
  return Math.max(0, ...steps.map(([at]) => at))
}
