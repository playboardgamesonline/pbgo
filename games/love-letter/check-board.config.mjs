// What only Love Letter knows about its board, for `pnpm check:board love-letter` (`docs/scripts.md`): the situations the windows are photographed in. The tool does the rest (seats, windows, frames, reload, the start, an absent player).
// Plain JavaScript, read by Node: no import of the game's code, since the board's files are TypeScript for the bundler.

/** The state is the view the viewer reads; `who` is the seat the game waits for (-1: nobody) */
const viewerTurn = (state, who) => who === 0 && state.view.phase.kind === "turn"
const cardsPlayed = (state) => state.view.players.reduce((count, player) => count + player.area.length, 0)

const config = {
  // The engine's own `turn` command plays every seat, the viewer's between the photographs included: it plays the lowest card that may be played, so that rounds end and tokens are won
  // The platform logs `[missing: <key>]` for every word the game's Sanity does not hold yet (the seed's drafts are not published)
  ignoreConsole: [/\[missing/],

  // The situations the windows are photographed in: the viewer's first turn, a round in (favor tokens on the plates, cards in the play areas), and between two rounds (the winners counted, the hands laid down when the round ended on a comparison)
  scenes: {
    async turn(table) {
      await table.advance({ until: viewerTurn, label: "the viewer's turn" })
    },
    async later(table) {
      await table.advance({
        until: (state, who) => viewerTurn(state, who) && state.view.round >= 2 && state.view.players.some((player) => player.tokens > 0) && cardsPlayed(state) >= state.view.players.length,
        max: 800,
        label: "the viewer's turn, a round in",
      })
    },
    async between(table) {
      // the deck cut to its last card at the viewer's turn, so that the round ends on a comparison and the hands that are left are laid down (a round that ends with one player in is counted at once and shows none): a round that ends the other way is played through and the cut is made again
      for (let round = 0; round < 6; round++) {
        await table.advance({ until: viewerTurn, label: "the viewer's turn" })
        await table.rig("oneCardLeft")
        const counted = await table.advance({ until: (state) => state.view.phase.kind === "between", max: 60, label: "the end of the round" })
        if (counted.view.phase.revealed) return
      }
      throw new Error("between two rounds: no round ended on a comparison in six tries")
    },
  },
}

export default config
