// What only Flip 7 knows about its board, for `pnpm check:board flip-7` (`docs/scripts.md`): how its seats play, the situations the windows are photographed in, what the viewer presses and the cases that the engine's debug commands rig.
// The tool does the rest (seats, windows, frames, reload, the start, an absent player). Plain JavaScript, read by Node: no import of the game's code, since the board's files are TypeScript for the bundler.

/** The view of a seat in a state the tool read */
const seatOf = (state, table, index) => state.view.players.find((player) => player.id === table.ids[index])
const holds = (seat, wanted) => seat.cards.some((card) => wanted(card.type))
const isNumber = (type) => type.startsWith("number-")
const isSecondChance = (type) => type === "second-chance"

/** What a seat does on its move: stays once it holds `stayAt` cards (it can only stay with one), deals when the deal is theirs, gives an action card to the first player who can get it */
function player({ state, me }, stayAt = 2) {
  const { phase, players } = state.view
  if (phase.kind === "between") return { type: "deal" }
  if (phase.kind === "target") return { type: "target", target: phase.targets[0] }
  const mine = players.find((seat) => seat.id === me)
  return { type: phase.canStay && mine.cards.length >= stayAt ? "stay" : "hit" }
}
/** A quicker table: a round ends sooner */
const quick = (context) => player(context, 1)

const viewerTurn = (state, who) => who === 0 && state.view.phase.kind === "turn"
/** Plays the table on until it is the turn of a seat (to hit or stay) */
const atTurn = (table, seat) => table.advance({ until: (state, who) => who === seat && state.view.phase.kind === "turn", label: `the turn of ${table.names[seat]}` })

/** Seat 1 and the last seat are the two opponents the cases are played with; the viewer is seat 0 */
const config = {
  // a long game, so that no case ends it
  options: { targetScore: 500 },
  bot: player,
  // the platform logs `[missing: <key>]` for every word the game's Sanity does not hold yet (the seed's drafts are not published)
  ignoreConsole: [/\[missing/],

  // The situations the windows are photographed in: the viewer's turn with a couple of cards on every line, between two rounds with the viewer to deal, and the viewer holding an action card to give (every plate is pressable)
  scenes: {
    async turn(table) {
      for (let round = 0; round < 2; round++) {
        await table.advance({ until: viewerTurn, label: "the viewer's turn" })
        await table.act(0, { type: "hit" })
      }
      await table.advance({ until: viewerTurn, label: "the viewer's turn" })
    },
    async deal(table) {
      await table.advance({ until: (state, who) => who === 0 && state.view.phase.kind === "between", bot: quick, label: "the viewer's deal" })
    },
    async target(table) {
      await table.advance({ until: viewerTurn, label: "the viewer's turn" })
      await table.rig("freezeOnTop")
      await table.act(0, { type: "hit" })
    },
  },

  // What the viewer presses, in the order the game offers it: the draw pile (hit), a zone of a seat to give an action card to (the first hit is rigged to turn a Freeze over, so that there is one to give), the Stay floor button and, once it is the viewer's
  // to deal, the Deal one. Everything else the viewer does is played through the API, to come to the next of these
  presses: {
    expect: ["hit", "target", "stay", "deal"],
    max: 40,
    // Between presses a table plays quickly: a round ends when everybody has stayed with a card, so that the deal, which comes round to the viewer once in a round of the table, is reached
    bot: quick,
    plan({ state, me, exercised }) {
      const { phase, players } = state.view
      const mine = players.find((seat) => seat.id === me)
      if (phase.kind === "turn" && phase.player === me) {
        if (!exercised.has("hit")) return { label: "hit", prepare: (table) => table.rig("freezeOnTop") }
        if (exercised.has("stay")) return null
        return phase.canStay && mine.cards.length >= 2 ? { label: "stay" } : { label: "hit" }
      }
      if (phase.kind === "target" && phase.player === me) return exercised.has("target") ? null : { label: "target" }
      if (phase.kind === "between" && phase.dealer === me) return exercised.has("deal") ? null : { label: "deal" }
      return null
    },
    // Where the controls lie, from what the board offers: the draw pile is far left of the middle (x -3), and to the right of it, in the strip between the two piles (z 0.5, `pilesZ`), lie the floor buttons: Hit left of the middle, Stay right of it, and Deal
    // alone in the middle. The zones of the seats, which are pressed to give an action card, are the other pressables (the viewer's own lies in front of them, in the middle: so the strip is told by its z)
    find({ label, pressables }) {
      const strip = (pressable) => pressable.world !== null && Math.abs(pressable.world[2] - 0.5) < 0.3
      const at = (low, high) => (pressable) => strip(pressable) && pressable.world[0] > low && pressable.world[0] < high
      if (label === "hit") return pressables.find(at(-2, -0.5))
      if (label === "stay") return pressables.find(at(0.5, 2.5))
      if (label === "deal") return pressables.find(at(-0.5, 0.5))
      if (label === "target") return pressables.find((pressable) => pressable.reachable) ?? pressables[0]
      return undefined
    },
  },

  // The cases of the Rig the deck folder of the debug panel, each recorded as frames
  scenarios: {
    // Ben draws a Flip Three and gives it to the last player, who flips three cards
    async flipthree({ table, seats, record, settle }) {
      await atTurn(table, 1)
      await table.rig("flipThreeOnTop")
      await table.act(1, { type: "hit" })
      await settle()
      return record(() => table.act(1, { type: "target", target: table.ids[seats - 1] }), { seconds: 8 })
    },
    // the last player draws a Freeze and gives it to Ben
    async freeze({ table, seats, record, settle }) {
      await atTurn(table, seats - 1)
      await table.rig("freezeOnTop")
      await table.act(seats - 1, { type: "hit" })
      await settle()
      return record(() => table.act(seats - 1, { type: "target", target: table.ids[1] }), { seconds: 6 })
    },
    // Ben draws a Second Chance, which he keeps
    async secondchance({ table, record, settle }) {
      await atTurn(table, 1)
      await table.rig("secondChanceOnTop")
      await settle()
      return record(() => table.act(1, { type: "hit" }), { seconds: 6 })
    },
    // Ben holds a Second Chance and a number, and draws a number he holds: saved
    async saved({ table, record, settle }) {
      for (let tries = 0; tries < 8; tries++) {
        const state = await atTurn(table, 1)
        const ben = seatOf(state, table, 1)
        if (holds(ben, isSecondChance) && holds(ben, isNumber)) break
        if (!holds(ben, isSecondChance)) await table.rig("secondChanceOnTop")
        await table.act(1, { type: "hit" })
      }
      await table.rig("bustOnTop")
      await settle()
      return record(() => table.act(1, { type: "hit" }), { seconds: 6 })
    },
    // the last player holds a number and draws one they hold: bust
    async bust({ table, seats, record, settle }) {
      const last = seats - 1
      for (let tries = 0; tries < 8; tries++) {
        const state = await atTurn(table, last)
        if (holds(seatOf(state, table, last), isNumber)) break
        await table.act(last, { type: "hit" })
      }
      await table.rig("bustOnTop")
      await settle()
      return record(() => table.act(last, { type: "hit" }), { seconds: 6 })
    },
    // Ben holds six different numbers and draws a seventh: Flip 7
    async flip7({ table, record, settle }) {
      await atTurn(table, 1)
      await table.rig("flip7")
      await settle()
      return record(() => table.act(1, { type: "hit" }), { seconds: 9 })
    },
  },
}

export default config
