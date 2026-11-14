// The undo stack of the playground: the states the table was in, so that the last change can be taken back and given again. Pure and generic: it knows nothing of the table but which of its fields changed.

export type History<T> = {
  past: T[]
  present: T
  future: T[]
  /** The fields the last change touched, as one word: a second change of the same fields in a row (a slider dragged) is the same entry */
  last: string | null
}

/** How many states the stack keeps */
export const HISTORY_LIMIT = 60

export const startHistory = <T>(present: T): History<T> => ({ past: [], present, future: [], last: null })

/** The names of the fields whose value differs between two states, in a stable order */
export function changedKeys<T extends object>(before: T, after: T): string[] {
  return (Object.keys(after) as (keyof T)[]).filter((key) => !Object.is(before[key], after[key])).map(String).sort()
}

/** How a change counts: `ignore` leaves no entry (the view of the camera, what is picked: the table is not different), `merge` joins the entry before it when it touches the same fields (a slider's drags), `push` is an entry of its own */
export type Kind = "ignore" | "merge" | "push"

/**
 * The stack after the table became `next`. An ignored change updates the present and nothing else; a merged one too, when the last change touched the same fields; a pushed one stores the present in the past, empties the future (a new
 * change ends what could be given again) and keeps the last `HISTORY_LIMIT` states.
 */
export function record<T extends object>(history: History<T>, next: T, classify: (keys: readonly string[]) => Kind): History<T> {
  if (Object.is(next, history.present)) return history
  const keys = changedKeys(history.present, next)
  if (keys.length === 0) return { ...history, present: next }
  const kind = classify(keys)
  if (kind === "ignore") return { ...history, present: next }
  const word = keys.join(",")
  if (kind === "merge" && history.last === word && history.past.length > 0) return { ...history, present: next }
  return { past: [...history.past, history.present].slice(-HISTORY_LIMIT), present: next, future: [], last: word }
}

/** One step back: the state before the last change, with what an undo must not touch (`keep`: the camera, the clock) taken from the present */
export function undo<T>(history: History<T>, keep: (before: T, now: T) => T = (before) => before): History<T> {
  const before = history.past.at(-1)
  if (before === undefined) return history
  return { past: history.past.slice(0, -1), present: keep(before, history.present), future: [history.present, ...history.future], last: null }
}

/** One step forward again, after an undo */
export function redo<T>(history: History<T>, keep: (after: T, now: T) => T = (after) => after): History<T> {
  const after = history.future[0]
  if (after === undefined) return history
  return { past: [...history.past, history.present], present: keep(after, history.present), future: history.future.slice(1), last: null }
}

export const canUndo = (history: History<unknown>) => history.past.length > 0
export const canRedo = (history: History<unknown>) => history.future.length > 0
