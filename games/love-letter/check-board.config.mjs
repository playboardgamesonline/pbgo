// What only Love Letter knows about its board, for `pnpm check:board love-letter` (`docs/scripts.md`): the situations the windows are photographed in, what the viewer presses and where, and the cases the engine's debug commands rig. The tool does the rest (seats,
// windows, frames, reload, the start, an absent player). Plain JavaScript, read by Node: no import of the game's code, since the board's files are TypeScript for the bundler.

/** The state is the view the viewer reads; `who` is the seat the game waits for (-1: nobody) */
const viewerTurn = (state, who) => who === 0 && state.view.phase.kind === "turn"
const cardsPlayed = (state) => state.view.players.reduce((count, player) => count + player.area.length, 0)
const handOf = (state) => state.view.me?.hand ?? []

/** How each character picks a player (the rules of the booklet): `other` another player, `any` any player (the Prince), `null` nobody */
const RULE = { spy: null, guard: "other", priest: "other", baron: "other", handmaid: null, prince: "any", chancellor: null, king: "other", countess: null, princess: null }

const config = {
  // The engine's own `turn` command plays every seat, the viewer's between the photographs included: it plays the lowest card that may be played, so that rounds end and tokens are won
  // The platform logs `[missing: <key>]` for every word the game's Sanity does not hold yet (the seed's drafts are not published)
  ignoreConsole: [/\[missing/],

  // The situations the windows are photographed in: the viewer's first turn, between two rounds (the winners counted, the hands laid down when the round ended on a comparison: first, since a game of five or six players is won in three rounds and the end of one of them would end it), a
  // round in (favor tokens on the plates, cards in the play areas), and the viewer holding the three cards of a Chancellor (the card to keep)
  scenes: {
    async turn(table) {
      await table.advance({ until: viewerTurn, label: "the viewer's turn" })
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
    async later(table) {
      await table.advance({
        until: (state, who) => viewerTurn(state, who) && state.view.round >= 2 && state.view.players.some((player) => player.tokens > 0) && cardsPlayed(state) >= state.view.players.length,
        max: 800,
        label: "the viewer's turn, a round in",
      })
    },
    async keep(table) {
      await table.advance({ until: viewerTurn, label: "the viewer's turn" })
      await table.rig("chancellorInHand")
      const state = await table.state(0)
      const chancellor = handOf(state).find((card) => card.type === "chancellor")
      // both Chancellors may be played already, in a late round: the rig puts none in the hand then, and the situation is the viewer's turn as it is
      if (!chancellor) return
      await table.act(0, { type: "play", card: chancellor.id })
    },
  },

  // What the viewer presses, in the order the game offers it. A move is two presses: a card of the hand, which only picks it (a `local` press: the table does not move), then the control that sends it: the Play pad for a card that picks nobody, a player's area for a
  // Priest, a Baron, a King or a Prince, the zone then one of the nine faces for a Guard, and after a Chancellor the card to keep, Swap and the Keep pad. Deal when it is the viewer's to deal. Everything else the viewer does is played through the API.
  presses: {
    expect: ["card", "play", "target", "name", "guess", "swap", "keep", "deal"],
    max: 90,
    budgetSeconds: 360,
    plan({ state, me, exercised }) {
      // a check begins with no move in mind: what the check before it left (a move that it stopped in the middle of) is forgotten
      if (running !== exercised) {
        running = exercised
        move = null
      }
      if (move?.final) move = null
      const view = state.view
      const { phase } = view
      if (phase.kind === "between" && phase.next === me) {
        move = null
        if (exercised.has("deal")) return null
        move = { final: true }
        return { label: "deal" }
      }
      if (phase.kind === "keep" && phase.player === me) {
        if (!move) {
          move = { stage: "card" }
          return { label: "card", local: true, prepare: rest }
        }
        if (move.stage === "card") {
          move.stage = "order"
          if (!exercised.has("swap") && handOf(state).length === 3) return { label: "swap", local: true }
        }
        move.final = true
        return { label: "keep" }
      }
      if (phase.kind === "turn" && phase.player === me) {
        if (!move) {
          const choice = choose(view, exercised)
          if (!choice) return null
          // `wanted` is the card the plan would like to pick; `find` picks it when the hand holds it (a rig may not bring it: the other copies may all be played) and says which card it pressed in `type`
          move = { wanted: choice.type, type: choice.type, stage: "picked" }
          return {
            label: "card",
            local: true,
            prepare: async (table) => {
              await rest()
              if (choice.rig) await table.rig(choice.rig)
            },
          }
        }
        const rule = RULE[move.type]
        const anyone = phase.targets.length > 0
        // after the card: a player to choose (a Prince can always choose its own player), or the pad that plays it
        if (rule === "any" || (rule === "other" && anyone)) {
          if (move.type === "guard") {
            if (move.stage === "picked") {
              move.stage = "named"
              return { label: "name", local: true }
            }
            move.final = true
            return { label: "guess" }
          }
          move.final = true
          return { label: "target" }
        }
        move.final = true
        return { label: "play" }
      }
      move = null
      return null
    },
    // Where the controls lie, from what the board offers: the cards of the hand, held at the bottom left of the screen in the frame of the camera (so far above the table, y beyond 4, and told apart by their place across the screen), the pad or pads of the moment and the
    // nine faces of a Guard in the strip in the middle (x within 2.6, z between -1.4 and 1.7, lying on the table), and the area of a player, a `Hotspot` that lies at a card's height (y about 0.35) so that the whole area answers, cards included
    find({ label, pressables, state }) {
      const world = (pressable) => pressable.world
      const inHand = (pressable) => world(pressable) && world(pressable)[1] > 4
      // a card that is still coming in from the deck is not in the hand yet, and a card in the air is pressed where it no longer is: `still` waits for the cards to have landed
      const inStrip = (pressable) => world(pressable) && Math.abs(world(pressable)[0]) < 2.6 && world(pressable)[2] > -1.4 && world(pressable)[2] < 1.7 && world(pressable)[1] < 0.1
      const isZone = (pressable) => world(pressable) && world(pressable)[1] > 0.3 && world(pressable)[1] < 0.4
      const byX = (a, b) => world(a)[0] - world(b)[0]
      const strip = pressables.filter(inStrip).sort(byX)
      const cards = pressables.filter(inHand).sort((a, b) => (a.center?.[0] ?? 0) - (b.center?.[0] ?? 0))
      const zones = pressables.filter(isZone)
      // a control is pressed once the ones it is picked from have not moved since the last look (`find` is asked every few tenths of a second): the cards that come in from the deck move for about a second, and a pixel that reaches one of them mid-way reaches another by the time it is pressed
      if (!still(label === "card" ? cards : label === "target" || label === "name" ? zones : strip)) return undefined
      if (label === "card") {
        const hand = handOf(state)
        // only a card that can be pressed carries a control (the Countess rule leaves the other card of the hand with none), and the fan lies in the order of the hand: so the place of a card in the line of controls is its place among the cards that can be pressed, once every one of
        // them has landed (a card that came from the deck a moment ago, which a rig does, is in the air, and the control at its place in the line would be another card's)
        const playable = state.view.phase.kind === "keep" ? new Set(hand.map((card) => card.id)) : new Set(state.view.me.playable)
        const pressing = hand.filter((card) => playable.has(card.id))
        if (cards.length !== pressing.length) return undefined
        let index = move?.wanted ? pressing.findIndex((card) => card.type === move.wanted) : -1
        if (index < 0) index = 0
        if (move && pressing[index]) move.type = pressing[index].type
        return cards[index]
      }
      if (label === "play" || label === "deal") return strip.find((pressable) => Math.abs(world(pressable)[0]) < 0.3)
      if (label === "swap") return strip.find((pressable) => world(pressable)[0] < -0.3)
      if (label === "keep") return strip.at(-1)
      if (label === "guess") return strip.find((pressable) => pressable.reachable) ?? strip[3]
      if (label === "target" || label === "name") return zones.find((pressable) => pressable.reachable) ?? zones[0]
      return undefined
    },
  },

  // The cases of the Rig the table folder of the debug panel, and the moves that tell something to read, each recorded as frames
  scenarios: {
    // the viewer plays the first card that shows something to read if they hold one (a Guard, a Priest, a Baron, a King), else their first card, on the first player who can be chosen; the others' moves of the same turn are recorded too
    async move({ table, record, settle }) {
      const state = await table.advance({ until: viewerTurn, label: "the viewer's turn" })
      const playable = handOf(state).filter((card) => state.view.me.playable.includes(card.id))
      const card = playable.find((held) => ["guard", "priest", "baron", "king"].includes(held.type)) ?? playable[0]
      const target = state.view.phase.targets[0]
      const picks = RULE[card.type] === null || target === undefined ? {} : { target, ...(card.type === "guard" ? { guess: "princess" } : {}) }
      await settle()
      return record(
        async () => {
          await table.act(0, { type: "play", card: card.id, ...picks })
          // the next seat, whose card may show something to read to the viewer
          await settle()
          await table.rig("turn")
        },
        { seconds: 8 },
      )
    },
    // the deck is cut to its last card and the round is played out: the hands that are left are laid down and the winner is counted
    async deckout({ table, record, settle }) {
      await table.advance({ until: viewerTurn, label: "the viewer's turn" })
      await table.rig("oneCardLeft")
      await settle()
      return record(() => table.rig("round"), { seconds: 7 })
    },
    // the viewer holds the Countess and the King: she must be played
    async countess({ table, record, settle }) {
      await table.advance({ until: viewerTurn, label: "the viewer's turn" })
      await table.rig("countessAndKing")
      await settle()
      const countess = handOf(await table.state(0)).find((card) => card.type === "countess")
      return record(() => table.act(0, { type: "play", card: countess.id }), { seconds: 6 })
    },
    // the viewer plays a Chancellor, keeps one card and puts the two others under the deck
    async chancellor({ table, record, settle }) {
      await table.advance({ until: viewerTurn, label: "the viewer's turn" })
      await table.rig("chancellorInHand")
      const chancellor = handOf(await table.state(0)).find((card) => card.type === "chancellor")
      await table.act(0, { type: "play", card: chancellor.id })
      await settle()
      const [kept, ...others] = handOf(await table.state(0))
      return record(() => table.act(0, { type: "keep", card: kept.id, bottom: others.map((card) => card.id).reverse() }), { seconds: 7 })
    },
  },
}

/** What the plan remembers of the move it is making, between its calls: the card it picked and how far it got (the version of the table stays the same until the last press, and a rig changes it, so the plan keeps its own count); `final` once it asked for the last press */
let move = null
/** The check the move belongs to (the set of the labels it pressed is its own): a new check forgets the move of the one before */
let running = null
/** Where the controls lay at the last look of `find`, as a line of text (see `still`) */
let looked = ""

/** Whether the controls have not moved since the last look, to the nearest twentieth of a unit of the table; the look is kept for the next one */
function still(list) {
  const look = list
    .filter((pressable) => pressable.world)
    .map((pressable) => pressable.world.map((value) => Math.round(value * 20)).join(","))
    .join(";")
  const quiet = look === looked
  looked = look
  return quiet
}

/** A pause before a card is picked, after a move was sent: the board does not take a card while the move is still being sent (it would be a press that does nothing), a moment a person never sees and a check that presses at once does */
const rest = () => new Promise((resolve) => setTimeout(resolve, 1000))

/**
 * The card the viewer picks first: the one that exercises a control that has not been pressed yet, a Guard (a zone, then one of the nine faces), a card that picks a player, the Chancellor (the card to keep, Swap and Keep: rigged into the hand when it is not there)
 * or a card that picks nobody. The Princess is never picked by choice: playing her puts the viewer out of the round.
 */
function choose(view, exercised) {
  const hand = view.me.hand
  const playable = new Set(view.me.playable)
  const holding = (types) => hand.find((card) => playable.has(card.id) && types.includes(card.type))
  const others = view.phase.targets.length > 0
  if (!exercised.has("guess") && others && holding(["guard"])) return { type: "guard" }
  if (!exercised.has("target")) {
    const card = holding(others ? ["priest", "baron", "king", "prince"] : ["prince"])
    if (card) return { type: card.type }
  }
  if (!exercised.has("keep")) return holding(["chancellor"]) ? { type: "chancellor" } : { type: "chancellor", rig: "chancellorInHand" }
  if (!exercised.has("play")) {
    const card = holding(["spy", "handmaid", "countess"])
    if (card) return { type: card.type }
  }
  return null
}

export default config
