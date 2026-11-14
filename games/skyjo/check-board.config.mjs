// What only Skyjo knows about its board, for `pnpm check:board skyjo` (`docs/scripts.md`): how its seats play, the situations the windows are photographed in, what the viewer presses and the cases that the engine's debug commands rig.
// The tool does the rest (seats, windows, frames, reload, the start, an absent player). Plain JavaScript, read by Node: no import of the game's code, since the board's files are TypeScript for the bundler.

/** The view of a seat in a state the tool read */
const mineOf = ({ state, me }) => state.view.players.find((seat) => seat.id === me)
const hiddenCells = (seat) => seat.cells.flatMap((cell, position) => (cell !== null && !cell.up ? [position] : []))

/**
 * What a seat does on its move: turns two cards over to open the round, then draws and puts the card over its first face-down card (or, with none left, over the first card), deals when the deal is theirs. A game ends in a few rounds: a seat
 * that always keeps what it draws has about the sum of a random grid.
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

/** The viewer's own choice (`choose`) */
const viewerChoice = (state, who) => who === 0 && state.view.phase.kind === "choose"
/** Plays the table on until it is the viewer's turn to choose (the opening is played through the API on the way) */
const atViewer = (table) => table.advance({ until: viewerChoice, label: "the viewer's turn" })

const config = {
  // the platform logs `[missing: <key>]` for every word the game's Sanity does not hold yet (the seed's drafts are not published)
  ignoreConsole: [/\[missing/],
  bot: player,

  // The situations the windows are photographed in: the viewer's turn to choose, holding a card they drew (the card in hand between the piles and the throw-away pad) and between two rounds with the viewer to deal
  scenes: {
    async turn(table) {
      await atViewer(table)
    },
    async drawn(table) {
      await atViewer(table)
      await table.act(0, { type: "draw" })
    },
    async deal(table) {
      await table.advance({ until: (state, who) => who === 0 && state.view.phase.kind === "between", label: "the viewer's deal" })
    },
  },

  // What the viewer presses, in the order the game offers it: a card of their grid to open the round, the draw pile's Draw pad, a card of the grid to put the card in hand in, the Take pad, the throw-away pad then a card to turn over, and the Deal pad when the deal
  // comes round to the viewer. Everything else the viewer does is played through the API, to come to the next of these
  presses: {
    expect: ["reveal", "draw", "place", "take", "throw", "flip", "deal"],
    max: 80,
    bot: player,
    plan({ state, me, exercised }) {
      const { phase } = state.view
      const mine = state.view.players.find((seat) => seat.id === me)
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
      void mine
      return null
    },
    // Where the controls lie, from what the board offers: the pads lie in the strip under the piles (z about 1.5: Draw left of the middle, Take and Throw away right of it, Deal across the middle), the cells of the viewer's grid in front of them (z of 2.2 and more)
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

  // The cases of the Rig the table folder of the debug panel, each recorded as frames
  scenarios: {
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
    // the viewer is one card from the end: turning it over ends the round, the others play a last turn
    async lastturn({ table, record, settle }) {
      await atViewer(table)
      await table.rig("lastCard")
      await table.act(0, { type: "draw" })
      await table.act(0, { type: "discard" })
      await settle()
      const hidden = (await table.state(0)).view.players[0].cells.findIndex((cell) => cell !== null && !cell.up)
      return record(() => table.act(0, { type: "flip", position: hidden }), { seconds: 8 })
    },
    // a round is counted, the points of the one who ended it are doubled or not, and the dealer deals the next one
    async count({ table, record }) {
      return record(() => table.rig("round"), { seconds: 10 })
    },
    // the end of a game
    async over({ table, record }) {
      await table.rig("nearTarget")
      return record(() => table.rig("round"), { seconds: 10 })
    },
  },
}

export default config
