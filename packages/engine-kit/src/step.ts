import type { LogEntry, Step } from "./log"
import { restoreRng, type SaveableRng } from "./rng"

/**
 * The machinery of a step, which every engine that says what happens wrote again: a step opens a private copy of the state, with the streams it keeps picked up where the last step left them, a few mutations follow, and the step closes with the streams saved
 * back and what happened noted. Nothing mutates the state that came in, and nothing draws from `Math.random`.
 */

/**
 * What a step works on: `s` is a copy of the state, to mutate freely; each stream the state keeps is here under the name of the field that saves it (`rng`, and `idsRng` for the side stream that issues ids); `events` is what happened so far, in order.
 * `S` is the state, `E` the events the game logs and `K` the names of its streams (`"rng"` unless it keeps others).
 */
export type StepContext<S, E, K extends string = "rng"> = { s: S; events: LogEntry<E>[] } & { [P in K]: SaveableRng }

// The streams a context opened, so that closing it needs no list again
const opened = new WeakMap<object, readonly string[]>()

/**
 * A step starts here: a copy of the state (`structuredClone`) and the streams picked up from the fields of the state that save them, `["rng"]` unless the game keeps others (`["rng", "idsRng"]`). A game gives its own `open` the type of its state:
 *
 * ```ts
 * export const open = (state: State) => openStep<State, MyEvent, "rng" | "idsRng">(state, ["rng", "idsRng"])
 * ```
 */
export function openStep<S extends { [P in K]: number }, E = unknown, K extends string = "rng">(state: S, streams: readonly K[] = ["rng" as K]): StepContext<S, E, K> {
  const s = structuredClone(state)
  const ctx = { s, events: [] as LogEntry<E>[] } as StepContext<S, E, K>
  for (const key of streams) (ctx as Record<string, unknown>)[key] = restoreRng(s[key])
  opened.set(ctx, streams)
  return ctx
}

/** A step ends here: every stream the step opened is saved back into the state, which comes out with what happened. `state` is the copy `openStep` made, never the one that came in */
export function closeStep<S, E, K extends string>(ctx: StepContext<S, E, K>): Step<S, E> {
  const state = ctx.s as Record<string, unknown>
  for (const key of opened.get(ctx) ?? []) state[key] = (ctx as unknown as Record<string, SaveableRng>)[key]!.save()
  return { state: ctx.s, events: ctx.events }
}

/**
 * Notes what happened, for everybody. When only some players may read it in full, `hidden` says who (`to`) and what everybody else reads instead (`masked`: the fact and never the card). See `LogEntry`.
 */
export function noteEvent<E>(ctx: { events: LogEntry<E>[] }, event: E, hidden?: { to: readonly string[]; masked: E }): void {
  ctx.events.push(hidden ? { event, ...hidden } : { event })
}
