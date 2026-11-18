import { isDeepStrictEqual } from "node:util"
import { createRng, isEngineError, playFor, waitingPlayers } from "@pbgo/engine-kit"
import { deepFreeze, reorderKeys } from "@pbgo/engine-kit/testing"
import { describe, expect, it } from "vitest"
import { step } from "./actions"
import type { CharacterKey } from "./catalogue"
import { GAME } from "./game"
import { enough, names, newState, problems, randomAction, seedOf, tokens, viewOf } from "./test-utils"
import { type Action, CLIENT_ACTIONS, LOVE_LETTER_ERROR_CODES, type LoveLetterEvent, type State } from "./types"

/**
 * Whole games, played at random and checked after every move.
 *
 * Tables of 2 to 6 players play to the end. Some players are away a third of the time, so that the takeover plays for them in every step. After each accepted
 * move this file checks what must hold whatever the cards are: that no card is lost, that the turn goes to the right player, that the move did what the booklet
 * says (the effect of the card played is written again here, from the names of the cards, as a small model of the rules that is not the engine's), that the
 * count of a round and the Spy's token are the booklet's, that the game ends when somebody holds the tokens that win and not before, that a stored copy of the
 * state replays the move, and that no view shows a hidden card.
 */

const found = new Map<string, { count: number; examples: string[] }>()
function flag(name: string, detail: string): void {
  const bucket = found.get(name) ?? { count: 0, examples: [] }
  bucket.count++
  if (bucket.examples.length < 3) bucket.examples.push(detail)
  found.set(name, bucket)
}
const report = (): string[] => [...found].map(([name, { count, examples }]) => `${name} ×${count}: ${examples.join(" | ")}`)

// --- The booklet, written again from the names of the cards

const VALUE: Record<string, number> = { spy: 0, guard: 1, priest: 2, baron: 3, handmaid: 4, prince: 5, chancellor: 6, king: 7, countess: 8, princess: 9 }
const TOKENS_TO_WIN: Record<number, number> = { 2: 6, 3: 5, 4: 4, 5: 3, 6: 3 }

const nameOf = (state: State, id: number): CharacterKey => names(state, [id])[0]!
const inRoundOf = (out: readonly boolean[]) => out.flatMap((isOut, seat) => (isOut ? [] : [seat]))

/**
 * What the booklet says of the cards after a card was played and its effect resolved, before the next player draws. `pending`: a Chancellor drew cards, and its
 * player has still to keep one: the turn is not over.
 */
type Model = { hands: number[][]; areas: number[][]; out: boolean[]; shielded: boolean[]; deck: number[]; aside: number | null; pending: boolean }

function modelPlay(before: State, mover: number, card: number, target: number | null, guess: CharacterKey | null): Model {
  const m: Model = {
    hands: before.hands.map((hand) => [...hand]),
    areas: before.areas.map((area) => [...area]),
    out: [...before.out],
    shielded: [...before.shielded],
    deck: [...before.deck],
    aside: before.aside,
    pending: false,
  }
  m.hands[mover] = m.hands[mover]!.filter((id) => id !== card)
  m.areas[mover]!.push(card)
  /** A player is out: their hand lies face up in front of them. */
  const knock = (seat: number) => {
    m.areas[seat]!.push(...m.hands[seat]!)
    m.hands[seat] = []
    m.out[seat] = true
  }
  const held = (seat: number) => m.hands[seat]![0]!
  switch (nameOf(before, card)) {
    case "guard":
      if (target !== null && nameOf(before, held(target)) === guess) knock(target)
      break
    case "baron":
      if (target !== null) {
        const [mine, theirs] = [VALUE[nameOf(before, held(mover))]!, VALUE[nameOf(before, held(target))]!]
        if (mine < theirs) knock(mover)
        else if (theirs < mine) knock(target)
      }
      break
    case "king":
      if (target !== null) [m.hands[mover], m.hands[target]] = [m.hands[target]!, m.hands[mover]!]
      break
    case "prince": {
      if (target === null) break
      const discarded = m.hands[target]!.splice(0)
      m.areas[target]!.push(...discarded)
      if (discarded.some((id) => nameOf(before, id) === "princess")) knock(target)
      else if (m.deck.length > 0) m.hands[target]!.push(m.deck.shift()!)
      else {
        m.hands[target]!.push(m.aside!)
        m.aside = null
      }
      break
    }
    case "chancellor": {
      // draws two cards, or the one that is left, or none (played with no effect)
      const drawn = m.deck.splice(0, 2)
      m.hands[mover]!.push(...drawn)
      m.pending = drawn.length > 0
      break
    }
    case "handmaid":
      m.shielded[mover] = true
      break
    case "princess":
      knock(mover)
      break
    default:
      // priest, spy, countess: nothing changes in the hands, the areas or the protection
      break
  }
  return m
}

/** Who wins a round and who earns the Spy's token (pp. 6, 13), from the cards the state holds once the round is over. */
function bookletRound(state: State): { how: "deck" | "last"; winners: number[]; spy: number | null } {
  const inRound = inRoundOf(state.out)
  const held = (seat: number) => VALUE[nameOf(state, state.hands[seat]![0]!)]!
  const how = inRound.length === 1 ? "last" : "deck"
  const best = Math.max(...inRound.map(held))
  const winners = how === "last" ? inRound : inRound.filter((seat) => held(seat) === best)
  const withSpy = inRound.filter((seat) => names(state, state.areas[seat]!).includes("spy"))
  return { how, winners, spy: withSpy.length === 1 ? withSpy[0]! : null }
}

/** What happens too rarely at random to be asked of these games: the rigged tests of the Chancellor hold them. */
const rare = { chancellorOneCard: 0, chancellorNoCard: 0 }

const tally = {
  games: 0,
  moves: 0,
  rounds: 0,
  ties: 0,
  spyTokens: 0,
  overs: 0,
  lastOne: 0,
  hits: 0,
  misses: 0,
  looks: 0,
  baronOuts: 0,
  baronTies: 0,
  swaps: 0,
  discards: 0,
  fizzles: 0,
  handmaids: 0,
  princesses: 0,
  forcedCountesses: 0,
  chosenCountesses: 0,
  chancellors: 0,
  keeps: 0,
  sizes: new Set<number>(),
  stages: new Set<string>(),
}

type Move = { at: string; before: State; action: Action | null; after: State; events: LoveLetterEvent[] }

function checkMove({ at, before, action, after, events }: Move): void {
  const ok = (name: string, condition: boolean, more?: () => string) => {
    if (!condition) flag(name, `${at} ${action === null ? "(played for)" : JSON.stringify(action)}${more ? ` — ${more()}` : ""}`)
  }
  const kinds = events.map((event) => event.kind)
  const n = before.seats.length
  tally.moves++
  tally.stages.add(after.stage.kind)

  for (const problem of problems(after)) flag(`state · ${problem}`, at)
  // the ids of the cards change only for the cards a Chancellor puts back (checked with the move that does it)
  if (!kinds.includes("bottom")) ok("ids changed", isDeepStrictEqual(before.ids, after.ids))
  ok("the seats changed", isDeepStrictEqual(before.seats, after.seats))

  // who the game waits for
  const waits = waitingPlayers(GAME, after)
  ok("waitingPlayers is not the player of the turn", isDeepStrictEqual(waits, GAME.isOver(after) ? [] : [after.seats[after.turn]]), () => JSON.stringify(waits))

  // the game ends when somebody holds the tokens that win, and not before (p. 7)
  ok("the game is over and nobody holds the tokens that win", GAME.isOver(after) === tokens(after).some((count) => count >= TOKENS_TO_WIN[n]!))
  ok("isOver and the tokens of the test do not agree", GAME.isOver(after) === enough(after))
  if (GAME.isOver(before)) flag("a move was played in a game that was over", at)

  /**
   * What a keep did (p. 10), whether the player pressed it after a Chancellor or the engine played it for them in the same step: the cards the player held then
   * (`hands`, `deck`: the state before the keep), the card they kept, and the cards they put under the deck, named by the ids they had in their hand.
   */
  const verifyKeep = (mover: number, hands: number[][], deck: number[], kept: number, back: number[]) => {
    tally.keeps++
    ok("the player kept a card that was not theirs", hands[mover]!.includes(kept))
    ok("a card was put back that was not the player's, or was kept too", back.every((id) => id !== kept && hands[mover]!.includes(id)) && back.length === hands[mover]!.length - 1)
    // the ids are those of `before`: a play does not change them
    const returned = back.map((id) => nameOf(before, id))
    const deckNames = [...deck.map((id) => nameOf(before, id)), ...returned]
    let next = -1
    for (let i = 1; i <= n && next < 0; i++) if (!before.out[(mover + i) % n] && !after.out[(mover + i) % n]) next = (mover + i) % n
    // the cards put back hold new ids, and nothing else changed its id (the kit's rule for a card that goes back into hiding, after a Chancellor)
    const retired = new Set(back)
    ok("an id changed that was not one of the cards put back", before.ids.every((id, i) => retired.has(id) !== (id === after.ids[i])))
    ok("the cards put back kept their old ids", back.every((id) => !after.ids.includes(id)))
    ok("the ids of the cards are not 21 different numbers", new Set(after.ids).size === 21)
    ok("the player's hand is not the card they kept", isDeepStrictEqual(after.hands[mover], [kept]))
    ok("the next player's hand is not the booklet's after a keep", isDeepStrictEqual(names(after, after.hands[next]!), [...hands[next]!.map((id) => nameOf(before, id)), deckNames[0]]))
    ok("the deck is not the booklet's after a keep: the cards put back go under it, the first one first", isDeepStrictEqual(names(after, after.deck), deckNames.slice(1)))
    ok("the cards that were already in the deck changed their ids", isDeepStrictEqual(after.deck.slice(0, Math.max(0, deck.length - 1)), deck.slice(1)))
    ok("the turn passed to the wrong seat after a keep", after.turn === next && after.stage.kind === "play")
    ok("the draw of the next player is not the last thing the log says", kinds.at(-1) === "draw" && kinds.includes("bottom"))
  }

  if (before.stage.kind === "play") {
    const mover = before.turn
    const played = events.find((event): event is Extract<LoveLetterEvent, { kind: "play" }> => event.kind === "play")
    ok("the card played is not the first thing the log says", kinds[0] === "play")
    if (played === undefined) return flag("a turn played no card", at)
    const card = played.card.id
    ok("a player played a card that was not theirs", before.hands[mover]!.includes(card))
    ok("the log names another player than the one who played", played.by === before.seats[mover])

    // the player the card picked, and the character a Guard named, as the move says them
    const said = events.find((event) => event.kind === "guess" || event.kind === "look" || event.kind === "compare" || event.kind === "swap" || event.kind === "discard")
    const targetId = action?.type === "play" ? action.target : said === undefined ? undefined : said.kind === "discard" ? said.player : "target" in said ? said.target : undefined
    const target = targetId === undefined ? null : before.seats.indexOf(targetId)
    const guess = action?.type === "play" ? (action.guess ?? null) : ((events.find((event) => event.kind === "guess") as { guess?: CharacterKey } | undefined)?.guess ?? null)
    const model = modelPlay(before, mover, card, target, guess)

    // the effect of the card, as the booklet says. A player who is played for keeps their card in the same step: the Chancellor's second half is checked as a keep
    const keptInTheSameStep = model.pending && action === null
    const waitsForKeep = model.pending && action !== null
    const ended = !model.pending && (inRoundOf(model.out).length === 1 || model.deck.length === 0)
    let next = -1
    for (let i = 1; i <= n && !ended && !model.pending && next < 0; i++) if (!model.out[(mover + i) % n]) next = (mover + i) % n
    ok("the play areas are not the booklet's after the move", isDeepStrictEqual(after.areas, model.areas))
    ok("the players out are not the booklet's after the move", isDeepStrictEqual(after.out, model.out))
    ok("the card set aside is not the booklet's after the move", after.aside === model.aside)
    if (keptInTheSameStep) {
      const said = events.find((event): event is Extract<LoveLetterEvent, { kind: "bottom" }> => event.kind === "bottom")
      if (said?.kept === undefined) flag("a Chancellor played for a player kept no card", at)
      else verifyKeep(mover, model.hands, model.deck, said.kept.id, (said.cards ?? []).map((face) => face.id))
      ok("the protection is not the booklet's after the move", isDeepStrictEqual(after.shielded, model.shielded.map((shielded, seat) => (seat === after.turn ? false : shielded))))
    } else {
      const expectedHands = model.hands.map((hand, seat) => (seat === next ? [...hand, model.deck[0]!] : hand))
      ok("the hands are not the booklet's after the move", isDeepStrictEqual(after.hands, expectedHands), () => `${JSON.stringify(after.hands)} against ${JSON.stringify(expectedHands)}`)
      ok("the protection is not the booklet's after the move", isDeepStrictEqual(after.shielded, model.shielded.map((shielded, seat) => (seat === next ? false : shielded))))
      ok("the deck is not the booklet's after the move", isDeepStrictEqual(after.deck, next >= 0 ? model.deck.slice(1) : model.deck))
    }
    if (waitsForKeep) {
      ok("a Chancellor did not wait for its player to keep a card", after.stage.kind === "keep" && after.turn === mover)
      ok("a Chancellor's cards are not in the log, for its player", kinds.at(-1) === "chancellor")
    } else if (!ended && !keptInTheSameStep) {
      ok("the turn passed to the wrong seat", after.turn === next, () => `${mover} → ${after.turn}`)
      ok("the draw is not in the log, for the player who drew it", kinds.at(-1) === "draw")
    }

    // what the log says of the effect
    const key = nameOf(before, card)
    const heldKeys = before.hands[mover]!.map((id) => nameOf(before, id))
    const forced = heldKeys.includes("countess") && (heldKeys.includes("king") || heldKeys.includes("prince"))
    ok("the Countess's rule was broken: a King or a Prince was played with her in hand", !forced || key === "countess")
    if (key === "countess") {
      if (forced) tally.forcedCountesses++
      else tally.chosenCountesses++
    }
    if (key === "handmaid") {
      tally.handmaids++
      ok("a Handmaid did not protect its player", after.shielded[mover] === true || before.hands[mover]!.length === 0 || ended)
    }
    if (key === "princess") {
      tally.princesses++
      ok("a Princess that was played did not knock out its player", after.out[mover] === true)
    }
    if (key === "guard" || key === "priest" || key === "baron" || key === "king") {
      const pickable = before.seats.flatMap((_, seat) => (seat !== mover && !before.out[seat] && !before.shielded[seat] ? [seat] : []))
      if (pickable.length === 0) {
        tally.fizzles++
        ok("a card that picks a player had nobody to pick and was not played with no effect", kinds.includes("fizzled"))
      } else ok("a card that picked a player was played with no effect", !kinds.includes("fizzled") && target !== null)
    }
    if (key === "guard" && target !== null) {
      const hit = nameOf(before, before.hands[target]![0]!) === guess
      ok("the guess is not told as the booklet says", events.some((event) => event.kind === "guess" && event.hit === hit))
      if (hit) tally.hits++
      else tally.misses++
    }
    if (key === "priest" && target !== null) tally.looks++
    if (key === "baron" && target !== null) {
      const [a, b] = [VALUE[nameOf(before, before.hands[mover]!.find((id) => id !== card)!)]!, VALUE[nameOf(before, before.hands[target]![0]!)]!]
      if (a === b) tally.baronTies++
      else tally.baronOuts++
      ok("a Baron's tie knocked somebody out", a !== b || !kinds.includes("out"))
    }
    if (key === "king" && target !== null) tally.swaps++
    if (key === "prince") tally.discards++
    if (key === "chancellor") {
      if (before.deck.length === 0) {
        rare.chancellorNoCard++
        ok("a Chancellor with no card left in the deck was not played with no effect", kinds.includes("fizzled") && !model.pending)
      } else {
        tally.chancellors++
        if (before.deck.length === 1) rare.chancellorOneCard++
        const drew = events.find((event): event is Extract<LoveLetterEvent, { kind: "chancellor" }> => event.kind === "chancellor")
        ok("a Chancellor did not say how many cards it drew", drew?.drew === Math.min(2, before.deck.length))
      }
    }
  }

  if (before.stage.kind === "keep") {
    // the cards a Chancellor's player puts under the deck, in the order they were placed, and the one they keep (p. 10)
    const mover = before.turn
    const said = events.find((event): event is Extract<LoveLetterEvent, { kind: "bottom" }> => event.kind === "bottom")
    const kept = action?.type === "keep" ? action.card : said?.kept?.id
    const back = action?.type === "keep" ? action.bottom : (said?.cards ?? []).map((face) => face.id)
    if (kept === undefined) return flag("a keep did not say which card was kept", at)
    verifyKeep(mover, before.hands, before.deck, kept, back)
    ok("the play areas changed with a keep", isDeepStrictEqual(after.areas, before.areas))
    ok("the players out changed with a keep", isDeepStrictEqual(after.out, before.out))
    ok("the card kept is not in the log", said?.kept?.id === kept)
    ok("a keep did not start with its entry in the log", kinds[0] === "bottom")
  }

  if (kinds.includes("end")) {
    tally.rounds++
    const end = events.find((event): event is Extract<LoveLetterEvent, { kind: "end" }> => event.kind === "end")!
    const expected = bookletRound(after)
    if (expected.winners.length > 1) tally.ties++
    if (expected.how === "last") tally.lastOne++
    if (expected.spy !== null) tally.spyTokens++
    ok("the round did not end the way the booklet says", end.how === expected.how)
    ok("the winners of the round are not the booklet's", isDeepStrictEqual(after.stage.kind === "between" ? after.stage.winners : null, expected.winners), () => JSON.stringify(expected.winners))
    ok("the Spy's token is not the booklet's", (after.stage.kind === "between" ? after.stage.spy : "x") === expected.spy, () => String(expected.spy))
    ok("the end event does not say the winners", isDeepStrictEqual(end.winners, expected.winners.map((seat) => after.seats[seat])))
    ok("the end event does not say the Spy's token", end.spy === (expected.spy === null ? null : after.seats[expected.spy]))
    after.seats.forEach((_, seat) => {
      ok("a winner did not gain a token", after.won[seat]! - before.won[seat]! === (expected.winners.includes(seat) ? 1 : 0), () => `seat ${seat}`)
      ok("the Spy's token was not gained as the booklet says", after.spies[seat]! - before.spies[seat]! === (expected.spy === seat ? 1 : 0), () => `seat ${seat}`)
    })
    ok("a round that ended on a comparison held the deck back", end.how === "last" || after.deck.length === 0)
    ok("a round ended on the deck without laying the hands face up", end.how === "last" || kinds.includes("reveal"))
    ok("a round ended on one player left laid hands face up", end.how === "deck" || !kinds.includes("reveal"))
    ok("the first turn of the next round is not a winner's", expected.winners.includes(after.turn))
    ok("the hands were not laid face up", after.stage.kind === "between" && after.stage.revealed === (end.how === "deck"))
    if (GAME.isOver(after)) {
      tally.overs++
      ok("the game ended without telling who won", kinds.at(-1) === "over")
    }
  }

  if (before.stage.kind === "between") {
    // the next round is dealt (p. 7): only the favor tokens carry over
    ok("a new round was not numbered", after.round === before.round + 1)
    ok("the favor tokens changed between two rounds", isDeepStrictEqual([before.won, before.spies], [after.won, after.spies]))
    ok("the player who takes the first turn changed", after.turn === before.turn)
    ok("a new round has the 21 cards", after.deck.length + 1 + after.faceUp.length + after.hands.flat().length + after.areas.flat().length === 21)
    ok("a new round kept somebody out", after.out.every((out) => !out) && after.shielded.every((shielded) => !shielded))
    ok("a new round kept cards in front of the players", after.areas.every((area) => area.length === 0))
    ok("a new round did not open with its round and the draw", isDeepStrictEqual(kinds, ["round", "draw"]))
  }

  // the views keep their secrets
  for (const viewer of [...after.seats, "stranger", null]) {
    const shown = after.stage.kind === "between" && after.stage.revealed
    const hidden = new Set<number>([...after.deck, ...(after.aside === null ? [] : [after.aside]), ...(shown ? [] : after.hands.filter((_, seat) => after.seats[seat] !== viewer).flat())])
    const json = JSON.stringify(viewOf(after, viewer))
    for (const id of hidden) if (json.includes(`"id":${id},`) || json.includes(`"id":${id}}`) || json.includes(`[${id},`) || json.includes(`,${id},`) || json.includes(`,${id}]`)) flag("a view shows a hidden id", `${at} ${viewer}`)
  }

  // a stored copy of the state replays the move
  if (action !== null) {
    const stored = reorderKeys(before)
    ok("a stored state does not replay the move", isDeepStrictEqual(step(stored, action).state, after))
  }
}

function play(n: number, seed: number, away: number): void {
  const rng = createRng(seed)
  let state = newState(n, seed)
  tally.games++
  tally.sizes.add(n)
  for (let i = 0; i < 30_000 && !GAME.isOver(state); i++) {
    const waits = waitingPlayers(GAME, state)
    const at = `${n}p seed ${seed} move ${i}`
    if (rng() < away) {
      const who = waits[Math.floor(rng() * waits.length)]!
      const after = playFor(GAME, state, who)
      const events = GAME.autoPlayStep!(state, who).events.map((entry) => entry.event)
      checkMove({ at, before: state, action: null, after, events })
      state = after
      continue
    }
    const action = randomAction(state, rng)
    const stepped = GAME.step!(deepFreeze(structuredClone(state)), action)
    checkMove({ at, before: state, action, after: stepped.state, events: stepped.events.map((entry) => entry.event) })
    state = stepped.state
  }
  if (!GAME.isOver(state)) flag("a game did not end", `${n}p seed ${seed}`)
  else {
    const results = GAME.view(state, null).results
    if (results === null) flag("a finished game has no results", `${n}p seed ${seed}`)
    else {
      const total = tokens(state)
      const winners = state.seats.filter((_, seat) => total[seat]! >= TOKENS_TO_WIN[n]!)
      if (!isDeepStrictEqual([...results.winners].sort(), [...winners].sort())) flag("the winners are not the players who hold the tokens that win", `${n}p seed ${seed}`)
      for (const row of results.players) {
        const won = winners.includes(row.playerId)
        if (row.rank !== (won ? 1 : 1 + winners.length)) flag("a rank is not the booklet's: winners first, no places", `${n}p seed ${seed} ${row.playerId}`)
        if (row.total !== total[state.seats.indexOf(row.playerId)]) flag("a total is not the player's tokens", `${n}p seed ${seed} ${row.playerId}`)
      }
    }
  }
}

/** Games for each table size: as many with nobody away as with players away a third of the time. */
const GAMES = 3

describe("random games, checked after every move", () => {
  for (let n = 2; n <= 6; n++) {
    it(`plays ${n} players to the end, ${GAMES * 2} times, half of them with players away a third of the time`, () => {
      for (let i = 0; i < GAMES; i++) {
        play(n, seedOf(100 + n * 10 + i), 0)
        play(n, seedOf(200 + n * 10 + i), 0.33)
      }
      expect(report().filter((line) => line.includes(`${n}p`) || !line.includes("p seed"))).toEqual([])
    }, 120_000)
  }

  it("meets what the rules can do, over those games", () => {
    expect(report()).toEqual([])
    expect([...tally.sizes].sort()).toEqual([2, 3, 4, 5, 6])
    expect(tally.overs).toBe(tally.games)
    for (const [what, count] of Object.entries(tally)) if (typeof count === "number") expect(count, what).toBeGreaterThan(0)
    for (const stage of ["play", "between"]) expect(tally.stages, stage).toContain(stage)
  })
})

describe("junk actions", () => {
  it("are refused with a code of the game's list, and never change the state", () => {
    const codes = new Set<string>([...LOVE_LETTER_ERROR_CODES, "INVALID_PLAYERS"])
    const rng = createRng(seedOf(11))
    let state = newState(4, seedOf(11))
    const junk = (): unknown[] => {
      const [who] = waitingPlayers(GAME, state)
      const types = [...CLIENT_ACTIONS, "fly", 7, null]
      const card = state.hands[state.turn]?.[0]
      const other = state.seats[(state.turn + 1) % 4]
      return [
        null, undefined, 3, "play", [], {},
        { type: types[Math.floor(rng() * types.length)], playerId: who },
        { type: types[Math.floor(rng() * types.length)], playerId: "zed" },
        { type: "play", playerId: who, card: Math.floor(rng() * 40) - 10 },
        { type: "play", playerId: who, card: "3" },
        { type: "play", playerId: who, card: 0.5 },
        { type: "play", playerId: who, card: Number.NaN },
        { type: "play", playerId: who, card: state.deck[0] },
        { type: "play", playerId: who, card, target: "zed" },
        { type: "play", playerId: who, card, target: who },
        { type: "play", playerId: who, card, target: 7 },
        { type: "play", playerId: who, card, target: other, guess: "dragon" },
        { type: "play", playerId: who, card, target: other, guess: "guard" },
        { type: "deal", playerId: who },
      ]
    }
    for (let i = 0; i < 400 && !GAME.isOver(state); i++) {
      const snapshot = structuredClone(state)
      for (const action of junk()) {
        try {
          step(deepFreeze(structuredClone(state)), action as Action)
        } catch (error) {
          expect(isEngineError(error), JSON.stringify(action)).toBe(true)
          expect(codes.has((error as { code: string }).code), `${(error as { code: string }).code} for ${JSON.stringify(action)}`).toBe(true)
        }
      }
      expect(state).toEqual(snapshot)
      state = step(state, randomAction(state, rng)).state
    }
  })
})
