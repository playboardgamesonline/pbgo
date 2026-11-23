import { describe, expect, it } from "vitest"
import { CARDS, GAME, GUESSES, waitingPlayers, type Action, type LogEntry, type LoveLetterEvent, type State } from "@love-letter/engine"
import { presentPlayers } from "@pbgo/core/server/takeover"
import { iso, SECOND, takeoverRig } from "@pbgo/core/server/takeover-rig"

/**
 * Acceptance test of the takeover of absent players (engine contract v2), on Love Letter.
 *
 * Three players sit at a table. Two of them never come back: the third one plays for them, vote after vote, and finishes the game alone.
 *
 * Nothing here needs Supabase. The engine and the voting rules of core are the real ones, and the table, the clock, `jsonb` and the glue of `POST /api/<slug>/games/<code>/takeover` are the rig of core (`takeoverRig`). Adapt this file with the engine: `humanMove` is the
 * only part that knows Love Letter. The game has no option that makes it shorter (the tokens that win come from the number of players), so it is played to its end at a few seeds: what is asserted holds for any of them, never a count of moves.
 */

// Ids of different lengths on purpose: the seat order is not the order `jsonb` gives the keys back in
const PLAYERS = [
  { id: "alice", nickname: "Alice" },
  { id: "bob", nickname: "Bob" },
  { id: "charlie", nickname: "Charlie" },
]

/**
 * What a human does on this board when the game waits for them: deals the next round; plays the first card of their hand that the Countess rule lets them, to the first player who can be chosen (themselves for a Prince when nobody else can be),
 * naming the first character that is not the Guard; and after a Chancellor keeps the card they held and puts the two others under the deck in the order of the hand. (Love Letter waits for one player at a time, whatever the step.)
 */
function humanMove(state: State, playerId: string): Action {
  const { me, phase } = GAME.view(state, playerId)
  switch (phase.kind) {
    case "between":
      return { type: "deal", playerId }
    case "keep": {
      const [kept, ...others] = me!.hand
      return { type: "keep", playerId, card: kept!.id, bottom: others.map((card) => card.id) }
    }
    case "turn": {
      const card = me!.hand.find((face) => me!.playable.includes(face.id))!
      const rule = CARDS[card.type].target
      const target = rule === null ? undefined : (phase.targets[0] ?? (rule === "any" ? playerId : undefined))
      return { type: "play", playerId, card: card.id, ...(target === undefined ? {} : { target }), ...(card.type === "guard" && target !== undefined ? { guess: GUESSES[0] } : {}) }
    }
    case "over":
      throw new Error("the game is over: nobody is waited for")
  }
}

const rig = takeoverRig({ game: GAME, players: PLAYERS, humanMove, maxSteps: 2000 })
const { takeover, wait, turnTimeout } = rig
const finishAlone = (table: ReturnType<typeof rig.open>) => rig.finishAlone(table, "charlie")
/** A table that has just started: Alice and Bob left two minutes ago, Charlie is here. */
const openTable = (seed = 11) => rig.open({ present: ["charlie"], seed })

const cardsPlayedBy = (log: LogEntry<LoveLetterEvent>[], playerId: string) => log.filter(({ event }) => event.kind === "play" && event.by === playerId).length

describe("absent players", () => {
  it.each([11, 12, 13, 14])("lets the third player finish a game where the other two never came back (seed %i)", (seed) => {
    const table = openTable(seed)
    expect(presentPlayers(PLAYERS, table.seen, table.now)).toEqual(["charlie"])
    // One player at a time, whatever the step: the vote of Charlie is for that one player
    expect(waitingPlayers(GAME, table.state)).toHaveLength(1)

    const { table: end, takeovers } = finishAlone(table)
    expect(GAME.isOver(end.state)).toBe(true)
    // Round after round, the absent players were played for: they played a card on their turn, whatever the Chancellor and the Prince asked of them, and dealt when it was their turn to
    expect(takeovers.alice).toBeGreaterThan(0)
    expect(takeovers.bob).toBeGreaterThan(0)
    expect(cardsPlayedBy(end.log, "alice")).toBeGreaterThan(0)
    expect(cardsPlayedBy(end.log, "bob")).toBeGreaterThan(0)
    // ...to the end of the game: everybody has a result, somebody won, and nobody is waited for
    const results = GAME.view(end.state, "charlie").results
    expect(results?.players).toHaveLength(3)
    expect(results?.winners.length).toBeGreaterThan(0)
    expect(waitingPlayers(GAME, end.state)).toEqual([])
  })

  it("needs the vote of every present player other than the one played for", () => {
    // Everybody is here this time: the player the game waits for is played for once the two others have voted
    const start = openTable()
    const [target] = waitingPlayers(GAME, start.state)
    const [first, second] = PLAYERS.map((player) => player.id).filter((id) => id !== target)
    const seen = Object.fromEntries(PLAYERS.map((player) => [player.id, iso(start.now)]))
    const quiet = wait({ ...start, seen }, turnTimeout * SECOND)

    const one = takeover(quiet, first!)
    expect(one.play).toEqual([])
    expect(waitingPlayers(GAME, one.table.state)).toEqual([target])
    expect(one.table.votes).toHaveLength(1)

    const two = takeover(one.table, second!)
    expect(two.play).toEqual([target])
    expect(waitingPlayers(GAME, two.table.state)).not.toContain(target)
  })
})
