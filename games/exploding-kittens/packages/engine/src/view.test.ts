import { type Rng, createRng, shuffle, viewLog } from "@pbgo/engine-kit"
import { describe, expect, it } from "vitest"
import { GAME } from "./game"
import {
  type Played,
  comboThrough,
  deepFreeze,
  defuse,
  draw,
  give,
  handIds,
  newState,
  nope,
  pass,
  play,
  playRandomly,
  playThrough,
  reorderKeys,
  rig,
  run,
  seedOf,
  titleOf,
  trace,
  viewOf,
} from "./test-utils"
import type { Face, PlayerView, State, Step } from "./types"

/**
 * What each viewer is shown: their own cards and what is public, nothing else. The first half pins the view of small tables built
 * by hand; the second half plays random games and, at every step and for every viewer, checks what no view may do: show a card
 * the viewer cannot see, or depend on one (the view of a table must not change when the hidden cards are swapped around).
 */

/** A table of four where everybody holds something else, with a few cards in the draw pile and on the discard. */
const BASE = {
  hands: {
    ana: ["skip", "attack", "tacocat", "defuse"],
    bob: ["nope", "favor", "beard-cat"],
    cleo: ["shuffle", "see-the-future", "defuse"],
    dan: ["tacocat", "tacocat"],
  },
  deck: ["attack", "exploding-kitten", "defuse", "nope", "cattermelon"],
  discard: ["skip", "beard-cat"],
}

/** Every viewer a table can have: the players, a spectator, and somebody who is not at the table. */
function viewersOf(state: State): (string | null)[] {
  return [...state.seats, null, "zoe"]
}

function faces(state: State, playerId: string): Face[] {
  return handIds(state, playerId).map((id) => ({ id, type: titleOf(state, id) }))
}

/** Somebody at the table who is still in the game: the only viewer who has a hand. */
function playing(state: State, viewer: string | null): viewer is string {
  return viewer !== null && state.seats.includes(viewer) && !state.out.includes(viewer)
}

/** The cards a viewer may see: the discard, the Kitten in the air, and for a player their hand and the top of the pile they know. */
function visibleIds(state: State, viewer: string | null): Set<number> {
  const shown = new Set<number>(state.discard)
  if (state.phase.kind === "defuse") shown.add(state.phase.kitten)
  if (playing(state, viewer)) {
    for (const id of handIds(state, viewer)) shown.add(id)
    for (const id of state.deck.slice(0, state.known[viewer] ?? 0)) shown.add(id)
  }
  return shown
}

/** Every card face (an object with a numeric `id`) found anywhere in a value. */
function facesIn(value: unknown, found: Face[] = []): Face[] {
  if (Array.isArray(value)) {
    for (const item of value) facesIn(item, found)
  } else if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>
    if (typeof record["id"] === "number") found.push({ id: record["id"], type: String(record["type"]) })
    for (const item of Object.values(record)) facesIn(item, found)
  }
  return found
}

/** Every object and array reachable from a value, itself included. */
function objectsIn(value: unknown, found = new Set<object>()): Set<object> {
  if (typeof value === "object" && value !== null && !found.has(value)) {
    found.add(value)
    for (const item of Object.values(value)) objectsIn(item, found)
  }
  return found
}

/** The numbers written in some JSON. The ids of the cards are 32-bit and random, so a small count never reads as one. */
function numbersIn(value: unknown): Set<number> {
  return new Set((JSON.stringify(value).match(/\d+/g) ?? []).map(Number))
}

/** What is wrong with a view for this viewer, in words; nothing when it shows no card they cannot see. */
function leaksOf(state: State, viewer: string | null, view: PlayerView): string[] {
  const found: string[] = []
  const shown = visibleIds(state, viewer)
  for (const face of facesIn(view)) {
    if (!shown.has(face.id)) found.push(`${viewer} is shown the card ${face.id} (${face.type}) that they cannot see`)
    else if (titleOf(state, face.id) !== face.type) found.push(`${viewer} is told that the card ${face.id} is a ${face.type}`)
  }
  const written = numbersIn(view)
  for (const id of state.ids) if (!shown.has(id) && written.has(id)) found.push(`${viewer} reads the id ${id} of a hidden card`)
  return found
}

/**
 * The same table for this viewer, as far as they can tell: the cards they cannot see (the other hands, the draw pile below what
 * they know, and the cards out of the game) are dealt again, and what a view never reads is changed (the streams, the stats of a
 * game on, what the others know of the pile and whether they passed). Not a state of the game, only a state to read a view from.
 */
function scrambled(state: State, viewer: string | null, rng: Rng): State {
  const copy = structuredClone(state)
  const me = playing(state, viewer) ? viewer : null
  const shownTop = me === null ? 0 : (state.known[me] ?? 0)
  const slots: [number[], number][] = []
  copy.hands.forEach((hand, seat) => {
    if (copy.seats[seat] !== me) hand.forEach((_, index) => slots.push([hand, index]))
  })
  copy.deck.forEach((_, index) => {
    if (index >= shownTop) slots.push([copy.deck, index])
  })
  const placed = new Set<number>([...copy.hands.flat(), ...copy.deck, ...copy.discard, ...(copy.phase.kind === "defuse" ? [copy.phase.kitten] : [])])
  const pool = shuffle([...slots.map(([cards, index]) => cards[index]!), ...copy.ids.filter((id) => !placed.has(id))], rng)
  slots.forEach(([cards, index], position) => {
    cards[index] = pool[position]!
  })
  copy.rng += 1
  copy.idsRng += 1
  if (copy.phase.kind !== "over") {
    for (const seat of copy.stats) {
      seat.turns += 3
      seat.defused += 1
      seat.nopes += 2
    }
  }
  for (const id of Object.keys(copy.known)) if (id !== me) copy.known[id] = copy.deck.length
  if (copy.phase.kind === "reaction") {
    const { passed } = copy.phase
    for (const id of Object.keys(passed)) if (id !== me) passed[id] = passed[id] === null ? true : null
  }
  return copy
}

/** The table with two cards swapped wherever they are placed (not in `ids`, which says what each id is). */
function swapped(state: State, a: number, b: number): State {
  const swap = (id: number): number => (id === a ? b : id === b ? a : id)
  return { ...state, hands: state.hands.map((hand) => hand.map(swap)), deck: state.deck.map(swap), discard: state.discard.map(swap) }
}

describe("the view of a table", () => {
  const table = rig(4, BASE)

  it("shows a player their hand, face up, and the others as a number of cards", () => {
    const view = viewOf(table, "bob")
    expect(view.me).toEqual({ id: "bob", hand: faces(table, "bob"), top: [] })
    expect(view.players).toEqual([
      { id: "ana", cards: 4, alive: true },
      { id: "bob", cards: 3, alive: true },
      { id: "cleo", cards: 3, alive: true },
      { id: "dan", cards: 2, alive: true },
    ])
    expect(view.deck).toBe(5)
    expect(view.discard.map(({ type }) => type)).toEqual(["skip", "beard-cat"])
    expect(view).toMatchObject({ turn: "ana", owed: 1, attacked: false, phase: { kind: "turn" }, out: [], results: null })
  })

  it("has exactly the keys of the contract", () => {
    const view = viewOf(table, "ana")
    expect(Object.keys(view).sort()).toEqual(["attacked", "deck", "discard", "me", "options", "out", "owed", "phase", "players", "results", "turn"])
    expect(Object.keys(view.me ?? {}).sort()).toEqual(["hand", "id", "top"])
    for (const player of view.players) expect(Object.keys(player).sort()).toEqual(["alive", "cards", "id"])
  })

  it("is plain data, which a database and the network keep as it is", () => {
    for (const viewer of viewersOf(table)) {
      const view = viewOf(table, viewer)
      expect(JSON.parse(JSON.stringify(view))).toStrictEqual(view)
    }
  })

  it("shares nothing with the state, which it leaves as it is", () => {
    const before = structuredClone(table)
    const view = viewOf(table, "ana")
    view.me?.hand.pop()
    view.discard.pop()
    view.out.push("zoe")
    view.players[0]!.cards = 99
    view.options["fiveDifferent"] = false
    expect(table).toStrictEqual(before)
    const frozen = deepFreeze(structuredClone(table))
    expect(table.seats.map((id) => viewOf(frozen, id))).toEqual(table.seats.map((id) => viewOf(table, id)))
  })

  it("does not depend on the order of the keys of the state", () => {
    const reordered = reorderKeys(table)
    for (const viewer of viewersOf(table)) expect(viewOf(reordered, viewer)).toEqual(viewOf(table, viewer))
  })

  it("gives a spectator, a stranger and a player who is out the same view", () => {
    const { ana, bob, cleo } = BASE.hands
    const out = rig(4, { hands: { ana, bob, cleo }, deck: BASE.deck, discard: BASE.discard, out: ["dan"] })
    const spectator = viewOf(out, null)
    expect(spectator.me).toBeNull()
    expect(viewOf(out, "zoe")).toEqual(spectator)
    expect(viewOf(out, "dan")).toEqual(spectator)
    expect(spectator.players.map(({ id, alive }) => [id, alive])).toEqual([["ana", true], ["bob", true], ["cleo", true], ["dan", false]])
    expect(spectator.out).toEqual(["dan"])
  })

  it("is the view of the game definition", () => {
    for (const viewer of viewersOf(table)) expect(GAME.view(table, viewer)).toEqual(viewOf(table, viewer))
  })
})

describe("the top of the draw pile", () => {
  const table = rig(3, {
    hands: { ana: ["see-the-future", "shuffle", "skip"], bob: ["tacocat"], cleo: ["beard-cat"] },
    deck: ["attack", "defuse", "nope", "cattermelon"],
  })
  const topOf = (state: State, viewer: string | null): string[] => viewOf(state, viewer).me?.top.map(({ type }) => type) ?? []

  it("is shown to the player who looked at it, and to nobody else", () => {
    const seen = playThrough(table, "ana", "see-the-future")
    expect(topOf(seen, "ana")).toEqual(["attack", "defuse", "nope"])
    for (const viewer of ["bob", "cleo", null, "zoe"]) expect(topOf(seen, viewer)).toEqual([])
  })

  it("gets shorter as the cards are drawn, whoever draws them", () => {
    const afterAna = run(playThrough(table, "ana", "see-the-future"), draw("ana"))
    expect(topOf(afterAna, "ana")).toEqual(["defuse", "nope"])
    expect(topOf(run(afterAna, draw("bob")), "ana")).toEqual(["nope"])
  })

  it("is lost when the pile is shuffled, which comes out under new ids", () => {
    const seen = playThrough(table, "ana", "see-the-future")
    const shuffled = playThrough(seen, "ana", "shuffle")
    expect(topOf(shuffled, "ana")).toEqual([])
    expect(shuffled.deck).toHaveLength(4)
    expect(shuffled.deck.some((id) => seen.deck.includes(id))).toBe(false)
  })

  it("is lost by the others when a Kitten goes back into the pile", () => {
    const kitten = rig(3, {
      hands: { ana: ["see-the-future", "skip"], bob: ["defuse"], cleo: ["tacocat"] },
      deck: ["exploding-kitten", "cattermelon", "beard-cat", "nope"],
    })
    const air = run(playThrough(playThrough(kitten, "ana", "see-the-future"), "ana", "skip"), draw("bob"))
    expect(air.phase.kind).toBe("defuse")
    expect(topOf(air, "ana")).toEqual(["cattermelon", "beard-cat"])
    expect(topOf(run(air, defuse("bob", 0)), "ana")).toEqual([])
  })
})

describe("the Nope window", () => {
  const window = run(rig(4, BASE), play("ana", "skip"))
  const phaseOf = (state: State, viewer: string | null): PlayerView["phase"] => viewOf(state, viewer).phase
  const open = { kind: "reaction", pending: { kind: "card", by: "ana", card: { id: window.discard[0]!, type: "skip" } }, nopes: [], chain: 0 }

  it("shows everybody the card played and the chain", () => {
    for (const viewer of viewersOf(window)) expect(phaseOf(window, viewer)).toMatchObject(open)
  })

  it("tells a responder whether they passed, and nobody else", () => {
    expect(phaseOf(window, "bob")).toStrictEqual({ ...open, passed: false })
    for (const viewer of ["ana", null, "zoe"]) expect(phaseOf(window, viewer)).toStrictEqual(open)
  })

  it("does not tell the others that somebody passed", () => {
    const passed = run(window, pass("bob"))
    expect(phaseOf(passed, "bob")).toStrictEqual({ ...open, passed: true })
    for (const viewer of ["ana", "cleo", "dan", null, "zoe"]) expect(viewOf(passed, viewer)).toEqual(viewOf(window, viewer))
  })

  it("makes the author of the card a responder once somebody Nopes it", () => {
    const noped = run(window, nope("bob"))
    const chained = { ...open, nopes: [{ card: { id: noped.discard[0]!, type: "nope" }, by: "bob" }], chain: 1 }
    expect(phaseOf(noped, "ana")).toStrictEqual({ ...chained, passed: false })
    expect(phaseOf(noped, "bob")).toStrictEqual(chained)
  })
})

describe("the steps that ask a player", () => {
  it("shows the Kitten in the air, and nothing of where it goes back", () => {
    const table = rig(3, {
      hands: { ana: ["defuse", "skip"], bob: ["attack"], cleo: ["tacocat"] },
      deck: ["exploding-kitten", "cattermelon", "beard-cat", "nope"],
    })
    const air = run(table, draw("ana"))
    if (air.phase.kind !== "defuse") throw new Error("The Kitten should be in the air")
    const kitten: Face = { id: air.phase.kitten, type: "exploding-kitten" }
    for (const viewer of viewersOf(air)) expect(viewOf(air, viewer).phase).toStrictEqual({ kind: "defuse", kitten })
    const back = [0, 1, 2, 3].map((position) => run(air, defuse("ana", position)))
    for (const viewer of viewersOf(air)) for (const state of back) expect(viewOf(state, viewer)).toEqual(viewOf(back[0]!, viewer))
    // Only the player who chose the place hears of it
    const [top, bottom] = [0, 3].map((position) => trace(air, defuse("ana", position)).events)
    for (const viewer of ["bob", "cleo", null, "zoe"]) expect(viewLog(top!, viewer)).toEqual(viewLog(bottom!, viewer))
    expect(viewLog(top!, "ana")).not.toEqual(viewLog(bottom!, "ana"))
  })

  it("tells everybody who gives a card to whom, and the two of them which card", () => {
    const table = rig(3, { hands: { ana: ["favor", "skip"], bob: ["attack", "tacocat"], cleo: ["beard-cat"] } })
    const asked = playThrough(table, "ana", "favor", "bob")
    for (const viewer of viewersOf(asked)) expect(viewOf(asked, viewer).phase).toStrictEqual({ kind: "give", from: "bob", to: "ana" })
    const { events } = trace(asked, give("bob", "attack"))
    const gave = (viewer: string | null) => viewLog(events, viewer).find((event) => event.kind === "give")
    expect(gave("ana")).toHaveProperty("card")
    expect(gave("bob")).toEqual(gave("ana"))
    for (const viewer of ["cleo", null, "zoe"]) {
      expect(gave(viewer)).toBeDefined()
      expect(gave(viewer)).not.toHaveProperty("card")
    }
  })

  it("shows the cards just played while one is taken from the discard", () => {
    const five = ["skip", "attack", "tacocat", "beard-cat", "shuffle"]
    const table = rig(3, { hands: { ana: five, bob: ["tacocat"], cleo: ["beard-cat"] }, discard: ["beard-cat", "exploding-kitten"] })
    const choosing = comboThrough(table, "ana", five)
    expect(choosing.phase.kind).toBe("pick")
    for (const viewer of viewersOf(choosing)) {
      const { phase } = viewOf(choosing, viewer)
      expect(phase.kind).toBe("pick")
      if (phase.kind === "pick") expect(phase.played.map(({ type }) => type).sort()).toEqual([...five].sort())
    }
  })

  it("ends with the results for everybody, and the player who lost is a spectator", () => {
    const table = rig(2, { hands: { ana: ["skip"], bob: ["attack"] }, deck: ["exploding-kitten", "cattermelon"], turn: "bob" })
    const over = run(table, draw("bob"))
    expect(over.phase.kind).toBe("over")
    for (const viewer of viewersOf(over)) {
      const view = viewOf(over, viewer)
      expect(view.turn).toBeNull()
      expect(view.results?.winners).toEqual(["ana"])
    }
    expect(viewOf(over, "bob")).toEqual(viewOf(over, null))
    expect(viewOf(over, "ana").me).not.toBeNull()
  })
})

/** Plays a few random games for each size of table and hands the start of each, then the state after each move, to `visit`. */
function walk(visit: (state: State, played: Played | null) => void): void {
  for (const n of [2, 3, 4, 5]) {
    for (const k of [0, 1, 2]) {
      const game = n * 10 + k
      const start = newState(n, seedOf(game))
      visit(start, null)
      playRandomly(start, seedOf(1000 + game), (played) => visit(played.state, played))
    }
  }
}

describe("on random games", () => {
  it("never shows a card the viewer cannot see, nor writes the id of one", () => {
    const found: string[] = []
    walk((state) => {
      for (const viewer of viewersOf(state)) found.push(...leaksOf(state, viewer, viewOf(state, viewer)))
    })
    expect(found).toEqual([])
  }, 60_000)

  it("shares no object with the state it is read from", () => {
    const found: string[] = []
    walk((state) => {
      const inState = objectsIn(state)
      for (const viewer of viewersOf(state)) {
        const shared = [...objectsIn(viewOf(state, viewer))].filter((object) => inState.has(object))
        if (shared.length > 0) found.push(`${viewer} holds ${shared.length} objects of the state`)
      }
    })
    expect(found).toEqual([])
  }, 60_000)

  it("does not depend on the cards the viewer cannot see, nor on what a view never reads", () => {
    const rng = createRng(seedOf(7))
    const found: string[] = []
    walk((state) => {
      for (const viewer of viewersOf(state)) {
        const seen = JSON.stringify(viewOf(state, viewer))
        for (let round = 0; round < 2; round++) {
          if (JSON.stringify(viewOf(scrambled(state, viewer, rng), viewer)) !== seen) found.push(`${viewer} sees a difference after a scramble`)
        }
      }
    })
    expect(found).toEqual([])
  }, 60_000)

  it("does depend on the cards it shows: swapping one with a hidden card changes the view", () => {
    const counts = { hand: 0, discard: 0, top: 0 }
    const found: string[] = []
    walk((state) => {
      for (const viewer of viewersOf(state)) {
        const shown = visibleIds(state, viewer)
        const hidden = state.ids.find((id) => !shown.has(id))
        if (hidden === undefined) continue
        const seen = JSON.stringify(viewOf(state, viewer))
        const swaps = (card: number | undefined, kind: keyof typeof counts): void => {
          if (card === undefined) return
          counts[kind]++
          if (JSON.stringify(viewOf(swapped(state, card, hidden), viewer)) === seen) found.push(`${viewer}: a ${kind} card can change and the view stays`)
        }
        swaps(playing(state, viewer) ? handIds(state, viewer)[0] : undefined, "hand")
        swaps(state.discard[0], "discard")
        swaps(playing(state, viewer) && (state.known[viewer] ?? 0) > 0 ? state.deck[0] : undefined, "top")
      }
    })
    expect(found).toEqual([])
    expect(counts.hand).toBeGreaterThan(0)
    expect(counts.discard).toBeGreaterThan(0)
    expect(counts.top).toBeGreaterThan(0)
  }, 60_000)

  it("keeps the place of a Kitten from everyone but the player who chose it", () => {
    const found: string[] = []
    let tried = 0
    walk((state) => {
      if (state.phase.kind !== "defuse") return
      tried++
      const by = state.seats[state.turn]!
      const positions = Array.from({ length: state.deck.length + 1 }, (_, position) => position)
      const outcomes = positions.map((position) => trace(state, defuse(by, position)))
      for (const viewer of viewersOf(state)) {
        const read = ({ state: next, events }: Step): string => {
          const view = viewOf(next, viewer)
          // The player who chose may know the cards above it: that is the one thing their view says of it
          if (viewer === by) return JSON.stringify({ ...view, me: view.me && { ...view.me, top: [] } })
          return JSON.stringify([view, viewLog(events, viewer)])
        }
        const first = read(outcomes[0]!)
        for (const position of positions) if (read(outcomes[position]!) !== first) found.push(`${viewer} tells position ${position} from 0`)
      }
    })
    expect(found).toEqual([])
    expect(tried).toBeGreaterThan(0)
  }, 60_000)

  it("hands every viewer an entry for each event, and no card they never see", () => {
    const found: string[] = []
    let count = 0
    walk((_, played) => {
      if (played === null) return
      const { before, state, events } = played
      count += events.length
      const known = new Set([...before.ids, ...state.ids])
      for (const viewer of viewersOf(before)) {
        const seen = viewLog(events, viewer)
        if (seen.length !== events.length) found.push(`${viewer} gets ${seen.length} entries for ${events.length} events`)
        const shown = new Set([...visibleIds(before, viewer), ...visibleIds(state, viewer)])
        for (const face of facesIn(seen)) {
          if (!shown.has(face.id)) found.push(`${viewer} reads the card ${face.id} (${face.type}) in the log and never sees it`)
          else if (titleOf(before.ids.includes(face.id) ? before : state, face.id) !== face.type) found.push(`${viewer} reads a wrong face in the log`)
        }
        for (const written of numbersIn(seen)) if (known.has(written) && !shown.has(written)) found.push(`${viewer} reads the id ${written} in the log`)
      }
    })
    expect(found).toEqual([])
    expect(count).toBeGreaterThan(100)
  }, 60_000)

  it("goes through every step of a game, and shows what it should of each", () => {
    const phases = new Set<string>()
    const kinds = new Set<string>()
    const shown = { passed: 0, top: 0 }
    walk((state, played) => {
      phases.add(state.phase.kind)
      for (const { event } of played?.events ?? []) kinds.add(event.kind)
      for (const viewer of viewersOf(state)) {
        const view = viewOf(state, viewer)
        if (view.phase.kind === "reaction" && view.phase.passed !== undefined) shown.passed++
        if ((view.me?.top.length ?? 0) > 0) shown.top++
      }
    })
    expect([...phases].sort()).toEqual(["defuse", "give", "over", "pick", "reaction", "turn"])
    for (const kind of ["draw", "play", "nope", "resolved", "kitten", "defused", "reinserted", "exploded", "attack", "skip", "shuffle", "see", "ask", "give", "steal", "over"]) {
      expect(kinds).toContain(kind)
    }
    expect(shown.passed).toBeGreaterThan(0)
    expect(shown.top).toBeGreaterThan(0)
  }, 60_000)
})
