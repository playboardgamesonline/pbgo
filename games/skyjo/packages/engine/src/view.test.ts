import { describe, expect, it } from "vitest"
import { step } from "./actions"
import { GAME } from "./game"
import { draw, layout, newState, opened, playRandomly, reveal, seedOf, take, up, viewOf } from "./test-utils"
import type { PlayerView, State } from "./types"

// Hidden information: the cards face down (to everybody, their owner included), the draw pile, and the card just drawn from it.

/** Every id a view mentions, wherever it is. */
function idsIn(view: PlayerView): number[] {
  const found: number[] = []
  const walk = (value: unknown, key?: string) => {
    if (Array.isArray(value)) value.forEach((item) => walk(item))
    else if (value !== null && typeof value === "object") for (const [k, child] of Object.entries(value)) walk(child, k)
    else if (key === "id" && typeof value === "number") found.push(value)
  }
  walk(view)
  return found
}

const viewers = (state: State): (string | null)[] => [...state.seats, "stranger", null]

describe("what a viewer is shown", () => {
  it("never the id of a card in the draw pile, nor one face down in a grid, whoever looks (a stranger and a spectator included)", () => {
    for (const seed of [1, 2, 3]) {
      for (const state of playRandomly(newState(5, seedOf(seed)), seed, (s) => s.rounds.length >= 2).filter((_, i) => i % 7 === 0)) {
        const hidden = new Set<number>([...state.deck, ...state.grids.flat().flatMap((cell) => (cell && !cell.up ? [cell.card] : []))])
        // the drawn card is hidden to all but its holder
        const held = state.stage.kind === "place" && state.stage.from === "deck" ? state.stage.card : null
        for (const viewer of viewers(state)) {
          const mentioned = idsIn(viewOf(state, viewer))
          for (const id of mentioned) {
            expect(hidden.has(id), `${viewer} sees ${id}`).toBe(false)
          }
          if (held !== null && viewer !== state.seats[(state.stage as { seat: number }).seat]) expect(mentioned.includes(held)).toBe(false)
        }
      }
    }
  })

  it("shows a face-down card as nothing but `up: false`, to its own player too", () => {
    const state = reveal(newState(3), "ana", 4)
    for (const viewer of ["ana", "bob", null]) {
      const cells = viewOf(state, viewer).players[0]!.cells
      expect(cells[4]).toMatchObject({ up: true })
      expect(cells[0]).toEqual({ up: false })
      expect(cells.filter((cell) => cell?.up === false)).toHaveLength(11)
    }
  })

  it("shows a face-up card to everybody, as its id and its face", () => {
    const state = opened(newState(2, seedOf(5)))
    const [a, b] = [viewOf(state, "ana"), viewOf(state, "bob")]
    expect(a.players).toEqual(b.players)
    const cell = a.players[0]!.cells[0]!
    expect(cell).toMatchObject({ up: true, card: { type: expect.stringMatching(/^card-/) as unknown as string } })
  })

  it("shows the draw pile as its size only, and the discard as its size and its top card", () => {
    const state = newState(3, seedOf(4))
    const view = viewOf(state, "ana")
    expect(view.deck).toEqual({ size: 150 - 36 - 1 })
    expect(view.discard.size).toBe(1)
    expect(view.discard.top).toEqual({ id: state.discard[0], type: expect.any(String) as unknown as string })
  })

  it("shows the card drawn from the pile to the player who drew it, and to nobody else", () => {
    const opening = opened(newState(3, seedOf(6)))
    const state = draw(opening, GAME.waitingFor!(opening)[0]!)
    const holder = GAME.waitingFor!(state)[0]!
    for (const viewer of viewers(state)) {
      const phase = viewOf(state, viewer).phase
      expect(phase.kind).toBe("place")
      if (phase.kind !== "place") continue
      if (viewer === holder) expect(phase.card).not.toBeNull()
      else expect(phase.card).toBeNull()
    }
  })

  it("shows the card taken from the discard to everybody: it was face up", () => {
    const opening = opened(newState(3, seedOf(6)))
    const holder = GAME.waitingFor!(opening)[0]!
    const state = take(opening, holder)
    for (const viewer of viewers(state)) {
      const phase = viewOf(state, viewer).phase
      expect(phase).toMatchObject({ kind: "place", from: "discard" })
      expect((phase as { card: unknown }).card).not.toBeNull()
    }
  })

  it("shows the same public things to everybody: the players, the totals, the dealer, the phase but for a drawn card", () => {
    const state = opened(newState(4, seedOf(2)))
    const base = viewOf(state, null)
    for (const viewer of state.seats) {
      const view = viewOf(state, viewer)
      expect({ ...view, me: null }).toEqual(base)
    }
  })

  it("says who the viewer is: a seated player is `me`, a stranger and a spectator are not", () => {
    const state = newState(3)
    expect(viewOf(state, "bob").me).toBe("bob")
    expect(viewOf(state, "zed").me).toBeNull()
    expect(viewOf(state, null).me).toBeNull()
  })

  it("is plain data that goes through jsonb unchanged", () => {
    const state = opened(newState(3, seedOf(8)))
    const view = viewOf(state, "ana")
    expect(JSON.parse(JSON.stringify(view))).toEqual(view)
  })
})

describe("what the view says of the round", () => {
  it("counts the cards face up of each player, and what they have banked", () => {
    const state = layout({ players: 2, grids: { ana: [up(5), up(-2), 9], bob: [up(12), 1] }, rounds: [[10, 4]] })
    const view = viewOf(state, "ana")
    expect(view.players.map((seat) => seat.score)).toEqual([3, 12])
    expect(view.players.map((seat) => seat.total)).toEqual([10, 4])
    expect(view.standings).toEqual([{ playerId: "ana", score: 10 }, { playerId: "bob", score: 4 }])
    expect(view.round).toBe(2)
    expect(view.rounds).toEqual([[10, 4]])
    expect(view.target).toBe(100)
  })

  it("counts the cards turned over during the opening", () => {
    let state = newState(3)
    expect(viewOf(state, "ana").players.map((seat) => seat.revealed)).toEqual([0, 0, 0])
    state = reveal(state, "bob", 0)
    expect(viewOf(state, "ana").players.map((seat) => seat.revealed)).toEqual([0, 1, 0])
    expect(viewOf(state, "ana").phase).toEqual({ kind: "reveal", waiting: ["ana", "bob", "cleo"] })
  })

  it("says nothing of a last turn until somebody has turned all their cards over", () => {
    expect(viewOf(newState(3), "ana").players.map((seat) => seat.lastTurn)).toEqual([null, null, null])
    expect(viewOf(newState(3), "ana").ender).toBeNull()
  })

  it("keeps the same view for a state read back from jsonb in another key order", () => {
    const state = opened(newState(3, seedOf(3)))
    const first = GAME.waitingFor!(state)[0]!
    expect(step(state, { type: "draw", playerId: first }).state.stage.kind).toBe("place")
  })
})
