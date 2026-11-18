// What only Skyjo knows about its board, for `pnpm check:board skyjo` (`docs/scripts.md`): how its seats play, the situations the windows are photographed in, what the viewer presses and the cases that the engine's debug commands rig.
// The tool does the rest (seats, windows, frames, reload, the start, an absent player). Plain JavaScript, read by Node: no import of the game's code, since the board's files are TypeScript for the bundler.

/** The view of a seat in a state the tool read */
const mineOf = ({ state, me }) => state.view.players.find((seat) => seat.id === me)
const hiddenCells = (seat) => seat.cells.flatMap((cell, position) => (cell !== null && !cell.up ? [position] : []))

/**
 * What a seat does on its move: turns two cards over to open the round, then draws and puts the card over its first face-down card (or, with none left, over the first card), deals when the deal is theirs. A seat that always keeps what it draws
 * has about the sum of a random grid, so a game of it ends in one round or two, and a round of eight of them runs the draw pile out.
 */
function player(context) {
  const { phase } = context.state.view
  const mine = mineOf(context)
  const hidden = hiddenCells(mine)
  switch (phase.kind) {
    case "reveal":
      return { type: "reveal", position: hidden[0] }
    case "choose":
      return { type: "draw" }
    case "place":
      return { type: "place", position: hidden[0] ?? mine.cells.findIndex((cell) => cell !== null) }
    case "flip":
      return { type: "flip", position: hidden[0] }
    case "between":
      return { type: "deal" }
    default:
      return null
  }
}

/** The engine's own player: null leaves the move to the debug `turn` command, which plays a whole turn as an absent player would, well enough that a game lasts several rounds and the viewer comes to deal */
const engine = () => null

/** The viewer's own choice (`choose`) */
const viewerChoice = (state, who) => who === 0 && state.view.phase.kind === "choose"
/** Plays the table on until it is the viewer's turn to choose (the opening is played through the API on the way) */
const atViewer = (table) => table.advance({ until: viewerChoice, label: "the viewer's turn" })
/** The hidden cell of the viewer that is left to turn over */
const lastHidden = async (table) => hiddenCells((await table.state(0)).view.players[0])[0]
/** One seat is left with its last turn, and it is its move: the move that ends the round (the viewer's own table, as `state` says it) */
const lastOfTheLastTurns = (state) => {
  const pending = state.view.players.filter((seat) => seat.lastTurn === "pending")
  return pending.length === 1 && state.waitingFor?.[0] === pending[0].id
}
/** The opening of a round: the other seats turn their two cards over, then the viewer turns one of theirs, and their second, which begins the round, is recorded */
async function opening({ table, record, settle, seats }) {
  for (let seat = 1; seat < seats; seat++) {
    await table.play(seat)
    await table.play(seat)
  }
  await table.act(0, { type: "reveal", position: 4 })
  await settle()
  return record(() => table.act(0, { type: "reveal", position: 7 }), { seconds: 7 })
}

const config = {
  bot: player,
  // a few turns are played before a reload or an absence, so that there are cards face up, a card on the discard and a score under each seat
  warm: 24,

  // The situations the windows are photographed in: the viewer's turn to choose, holding a card they drew (the card in hand between the piles and the throw-away pad) and between two rounds (the count under each seat and the dealer's pad or the word
  // that says who deals), reached by playing the first round with the engine's own player, a move at a time, so that the board plays out the last one as it would
  scenes: {
    async turn(table) {
      await atViewer(table)
    },
    async drawn(table) {
      await atViewer(table)
      await table.act(0, { type: "draw" })
    },
    async between(table) {
      await table.advance({ until: (state) => state.view.phase.kind === "between", bot: engine, label: "between two rounds" })
    },
  },

  // What the viewer presses, in the order the game offers it: a card of their grid to open the round, the draw pile's Draw pad, a card of the grid to put the card in hand in, the Take pad, the throw-away pad then a card to turn over, and the Deal pad when the deal
  // comes round to the viewer (once in a round of the table: at a big table the game ends before, which the report says). Everything else the viewer does is played through the API, to come to the next of these. The seats play as an absent player would,
  // so that a game lasts several rounds
  presses: {
    expect: ["reveal", "draw", "place", "take", "throw", "flip", "deal"],
    max: 80,
    bot: engine,
    plan({ state, me, exercised }) {
      const { phase } = state.view
      if (phase.kind === "reveal" && phase.waiting.includes(me)) return { label: "reveal" }
      if (phase.kind === "choose" && phase.player === me) {
        if (!exercised.has("draw")) return { label: "draw" }
        if (!exercised.has("take")) return { label: "take" }
        return exercised.has("throw") ? null : { label: "draw" }
      }
      if (phase.kind === "place" && phase.player === me) {
        if (phase.from === "discard") return exercised.has("place") ? null : { label: "place" }
        if (!exercised.has("place")) return { label: "place" }
        return exercised.has("throw") ? null : { label: "throw" }
      }
      if (phase.kind === "flip" && phase.player === me) return exercised.has("flip") ? null : { label: "flip" }
      if (phase.kind === "between" && phase.dealer === me) return exercised.has("deal") ? null : { label: "deal" }
      return null
    },
    // Where the controls lie, from what the board offers: the pads lie in the strip under the piles (z about 1.6: Draw left of the middle, Take and Throw away right of it, Deal across the middle), the cells of the viewer's grid in front of them (z of 3 and more)
    find({ label, pressables }) {
      const strip = (pressable) => pressable.world !== null && pressable.world[2] > 1 && pressable.world[2] < 2.1
      const cells = pressables.filter((pressable) => pressable.world !== null && pressable.world[2] >= 2.1)
      if (label === "draw") return pressables.find((pressable) => strip(pressable) && pressable.world[0] < -0.5)
      if (label === "take" || label === "throw") return pressables.find((pressable) => strip(pressable) && pressable.world[0] > 0.5)
      if (label === "deal") return pressables.find((pressable) => strip(pressable) && Math.abs(pressable.world[0]) < 0.5)
      if (label === "reveal" || label === "place" || label === "flip") return cells.find((pressable) => pressable.reachable) ?? cells[0]
      return undefined
    },
  },

  // The cases of the Rig the table folder of the debug panel, each recorded as frames, in the order they are played: one table serves all of them. Each records one move that a player makes, so that the board plays out what it would in a game: a debug
  // command that plays a turn for a seat writes nothing to the log of the table, and the board plays nothing of it, so the commands only bring the table to the situation (they are used to play a round down to its last move, and to rig a grid)
  scenarios: {
    // the opening of the first round: the other seats turn their two cards over, then the viewer turns theirs, and the second one, which finds who begins, is recorded (`start` of the log, which says the sum that decided)
    async turn(context) {
      return opening(context)
    },
    // the viewer takes the discard that completes a column of two equal cards: the three go to the discard
    async column({ table, record, settle }) {
      await atViewer(table)
      await table.rig("columnOnTop")
      await table.act(0, { type: "take" })
      await settle()
      return record(() => table.act(0, { type: "place", position: 2 }), { seconds: 6 })
    },
    // the viewer draws a card and puts it over a face-down one
    async place({ table, record, settle }) {
      await atViewer(table)
      await table.act(0, { type: "draw" })
      await settle()
      return record(() => table.act(0, { type: "place", position: 5 }), { seconds: 6 })
    },
    // the viewer draws a high card, throws it away and turns a card over
    async throwaway({ table, record, settle }) {
      await atViewer(table)
      await table.rig("highOnTop")
      await table.act(0, { type: "draw" })
      await settle()
      await table.act(0, { type: "discard" })
      await settle()
      return record(() => table.act(0, { type: "flip", position: 8 }), { seconds: 6 })
    },
    // at a full table the draw pile runs out in nearly every round: whoever draws from the empty one has the discard shuffled into a new pile (the move that does it is recorded; a table of fewer seats ends the round first)
    async reshuffle({ table, record, settle, seats }) {
      if (seats < 7) return undefined
      let who = -1
      await table.advance({
        until: (state, waited) => {
          who = waited
          return state.view.deck.size === 0 && state.view.phase.kind === "choose"
        },
        max: 700,
        label: "the draw pile runs out",
      })
      await settle()
      return record(() => table.play(who), { seconds: 8 })
    },
    // the rest of the first round is played by the engine's own player, a turn at a time (a game that lasts: the dumb player of the cases above would end it with the count), down to the last turn of the last player, whose move, putting the card they drew,
    // ends the round and is recorded: the count, the points of the one who ended it doubled or not
    async count({ table, record, settle }) {
      await table.advance({ until: lastOfTheLastTurns, bot: engine, label: "the last of the last turns" })
      const seat = table.waitedFor(await table.state(0))
      await table.play(seat)
      await settle()
      return record(() => table.play(seat), { seconds: 10 })
    },
    // the dealer deals the second round (a deal goes round the table card by card)
    async deal({ table, record, settle }) {
      const state = await table.state(0)
      if (state.status !== "playing" || state.view.phase.kind !== "between") return undefined
      const dealer = table.ids.indexOf(state.view.phase.dealer)
      await settle()
      return record(() => table.act(dealer, { type: "deal" }), { seconds: 8 })
    },
    // the opening of the second round: whoever ended the first one begins it, whatever the sums (`start` of the log with `how: "ender"`: its line is left out of the history)
    async second(context) {
      const state = await context.table.state(0)
      if (state.status !== "playing" || state.view.phase.kind !== "reveal") return undefined
      return opening(context)
    },
    // the viewer is one card from the end: turning it over ends the round, the others play a last turn
    async lastturn({ table, record, settle }) {
      if ((await table.state(0)).status !== "playing") return undefined
      await atViewer(table)
      await table.rig("lastCard")
      await table.act(0, { type: "draw" })
      await table.act(0, { type: "discard" })
      await settle()
      return record(async () => table.act(0, { type: "flip", position: await lastHidden(table) }), { seconds: 8 })
    },
    // the end of the game, from the start of a table: the viewer's total is rigged to 94 (`nearTarget` writes a finished round down, so it only makes sense before any round was counted: after one it would end the game at once), the viewer ends the
    // round, the others play their last turn, and the last move, which counts the round and ends the game, is recorded: the winner and the end screen. Run it on its own (`--scenarios over`): after the cases above it finds a round counted and does nothing
    async over({ table, record, settle }) {
      const state = await table.state(0)
      if (state.status !== "playing" || state.view.players.some((seat) => seat.total !== 0)) return undefined
      await atViewer(table)
      await table.rig("nearTarget")
      await table.rig("lastCard")
      await table.act(0, { type: "draw" })
      await table.act(0, { type: "discard" })
      await table.act(0, { type: "flip", position: await lastHidden(table) })
      await table.advance({ until: lastOfTheLastTurns, label: "the last of the last turns" })
      const seat = table.waitedFor(await table.state(0))
      await table.play(seat)
      await settle()
      const recorded = await record(() => table.play(seat), { seconds: 12 })
      const after = await table.state(0)
      if (after.status !== "over") throw new Error(`the last round was counted and the table is "${after.status}", not over`)
      return recorded
    },
  },
}

export default config
