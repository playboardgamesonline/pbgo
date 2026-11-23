import { type GameDefinition, type LogEntry, type OptionValues, type PlayerAction, type PlayerInfo, playStepFor, setupOf, stepOf, waitingPlayers } from "@pbgo/engine-kit"
import { castVotes, isStalled, presentPlayers } from "./takeover"

/**
 * The rig of the acceptance test of the takeover of absent players (engine contract v2), which every game's `src/takeover.test.ts` wrote again: a table that is a plain object, a clock, the way `jsonb` gives a state back, the glue of
 * `POST /api/<slug>/games/<code>/takeover` and a player who plays to the end of the game alone. The engine (`GAME`, `waitingPlayers`, `playStepFor`) and the voting rules of core (`castVotes`, `presentPlayers`, `isStalled`) are the real ones; nothing needs Supabase.
 * A game gives it what only it knows, `humanMove`, and writes its own assertions.
 */

export const SECOND = 1000
export const MINUTE = 60 * SECOND

/** The clock a table starts at unless the rig is told another */
const START = Date.parse("2026-10-12T10:00:00.000Z")

/** What the server keeps of a table (the columns of `games`), and the clock of the test */
export type TakeoverTable<State, E> = {
  state: State
  /** The log of the table (`game_log`): what each move said, in order. The state keeps none */
  log: LogEntry<E>[]
  /** `takeover_votes` */
  votes: string[]
  /** `seen`: when the server last saw each player, an ISO time */
  seen: Record<string, string>
  /** `updated_at`: the last write, an ISO time */
  updatedAt: string
  /** The clock of the test, in milliseconds */
  now: number
}

export const iso = (time: number) => new Date(time).toISOString()

/** The way Postgres `jsonb` gives a value back: the keys of every object shortest first, then alphabetically, whatever order they were written in. A state that is read back from the database comes out like this, so an engine that took an order from the keys of an object would break here */
export function jsonb<T>(value: T): T {
  const sorted = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sorted)
    if (!v || typeof v !== "object") return v
    const keys = Object.keys(v).sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0))
    return Object.fromEntries(keys.map((key) => [key, sorted((v as Record<string, unknown>)[key])]))
  }
  return sorted(JSON.parse(JSON.stringify(value))) as T
}

/** Stamp of a state for the votes. The server uses `stateFingerprint` (same hash), which can't be imported here: it pulls Supabase in */
export function stamp(state: unknown): string {
  const text = JSON.stringify(state)
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

export type TakeoverRigOptions<State, Action extends PlayerAction, SetupData, E> = {
  game: GameDefinition<State, Action, unknown, SetupData, E>
  /** The table: the ids of different lengths on purpose, so that the seat order is not the order `jsonb` gives the keys back in */
  players: readonly PlayerInfo[]
  /** What a human does on this board when the game waits for them. The only part that knows the game */
  humanMove: (state: State, playerId: string) => Action
  /** Admin › Mechanics: a table that has not moved for this long, in seconds, can be taken over (60 by default) */
  turnTimeout?: number
  /** The clock the table starts at, in milliseconds since the epoch */
  start?: number
  /** The most steps `finishAlone` takes before it says that the game does not end (1000) */
  maxSteps?: number
}

/** A rig for one game: see `takeoverRig` */
export type TakeoverRig<State, E> = {
  players: readonly PlayerInfo[]
  /** The delay, in seconds, after which a table can be taken over */
  turnTimeout: number
  /** A table that has just started, with the options and the seed: the players in `present` are here, the others left two minutes ago */
  open(config: { present: readonly string[]; options?: OptionValues; seed?: number }): TakeoverTable<State, E>
  /** The clock goes on by `ms` */
  wait(table: TakeoverTable<State, E>, ms: number): TakeoverTable<State, E>
  /** A player's own move (`POST .../action`): the server writes it and notes that the player is here. The votes of the previous state stay, and are ignored */
  act(table: TakeoverTable<State, E>, playerId: string): TakeoverTable<State, E>
  /**
   * `POST /api/<slug>/games/<code>/takeover` without HTTP: `voter` votes for `targets` (by default every player the game waits for), and the players whose vote is complete are played for, in the same write. Same steps as
   * `packages/core/routes/api/games/[code]/takeover/route.ts`. Throws `NOT_STALLED` when the table has not been quiet for the delay
   */
  takeover(table: TakeoverTable<State, E>, voter: string, targets?: string[]): { table: TakeoverTable<State, E>; play: string[] }
  /** `who`, the only one left, plays to the end of the game: their own move when the game waits for them, otherwise they let the delay pass and vote for everyone the game waits for. Tells how many times each absent player was played for */
  finishAlone(start: TakeoverTable<State, E>, who: string): { table: TakeoverTable<State, E>; takeovers: Record<string, number> }
}

/** Makes the rig of the takeover test for a game */
export function takeoverRig<State, Action extends PlayerAction, SetupData, E>({ game, players, humanMove, turnTimeout = 60, start = START, maxSteps = 1000 }: TakeoverRigOptions<State, Action, SetupData, E>): TakeoverRig<State, E> {
  type Table = TakeoverTable<State, E>
  const wait = (table: Table, ms: number): Table => ({ ...table, now: table.now + ms })

  const act = (table: Table, playerId: string): Table => {
    const played = stepOf(game, table.state, humanMove(table.state, playerId))
    return { ...table, state: jsonb(played.state), log: [...table.log, ...played.events], updatedAt: iso(table.now), seen: { ...table.seen, [playerId]: iso(table.now) } }
  }

  const takeover = (table: Table, voter: string, targets?: string[]): { table: Table; play: string[] } => {
    if (!isStalled(table.updatedAt, table.now, turnTimeout)) throw new Error("NOT_STALLED")
    const waiting = waitingPlayers(game, table.state)
    const { entries, play } = castVotes({
      players,
      waiting,
      present: presentPlayers(players, table.seen, table.now),
      entries: table.votes,
      fingerprint: stamp(table.state),
      voter,
      targets: targets ?? waiting,
    })
    const seen = { ...table.seen, [voter]: iso(table.now) }
    if (!play.length) return { table: { ...table, votes: entries, seen }, play }
    let state = table.state
    const log = [...table.log]
    for (const target of play) {
      if (game.isOver(state)) break
      if (waitingPlayers(game, state).includes(target)) {
        const played = playStepFor(game, state, target)
        state = played.state
        log.push(...played.events)
      }
    }
    return { table: { ...table, state: jsonb(state), log, votes: [], seen, updatedAt: iso(table.now) }, play }
  }

  const finishAlone = (first: Table, who: string): { table: Table; takeovers: Record<string, number> } => {
    let table = first
    const takeovers: Record<string, number> = {}
    for (let step = 0; !game.isOver(table.state); step++) {
      if (step >= maxSteps) throw new Error("the game does not end")
      if (waitingPlayers(game, table.state).includes(who)) {
        table = act(table, who)
        continue
      }
      const result = takeover(wait(table, turnTimeout * SECOND), who)
      table = result.table
      for (const target of result.play) takeovers[target] = (takeovers[target] ?? 0) + 1
    }
    return { table, takeovers }
  }

  const open = ({ present, options = {}, seed = 11 }: { present: readonly string[]; options?: OptionValues; seed?: number }): Table => {
    const opened = setupOf(game, { players: [...players], options, seed })
    return {
      state: jsonb(opened.state),
      log: [...opened.events],
      votes: [],
      seen: Object.fromEntries(players.map(({ id }) => [id, iso(present.includes(id) ? start : start - 2 * MINUTE)])),
      updatedAt: iso(start),
      now: start,
    }
  }

  return { players, turnTimeout, open, wait, act, takeover, finishAlone }
}
