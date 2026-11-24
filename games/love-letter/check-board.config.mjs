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

  // What the viewer presses, in the order the game offers it. Objects are pressed, so a move is one press or a few: a card that picks nobody is played by pressing it (`play`), a card that picks a player is held by pressing it (`card`, a `local` press: the table does not
  // move) and then played by pressing the player's cards (`target`); for a Guard the window that the board opens is used: its player (`name`, local, a `dom` control), then one of the nine characters (`guess`, local) and Play (`validate`). After a Chancellor the card to keep is pressed (`keep`: held when there are three cards, sent at once
  // when there are two) and then the card that goes under the deck first (`order`). Deal is the one button, when it is the viewer's to deal. Everything else the viewer does is played through the API.
  presses: {
    expect: ["card", "play", "target", "name", "guess", "validate", "keep", "order", "deal"],
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
        // three cards: the first card pressed is held as the one kept, and the next one pressed goes under the deck first; two cards: the card pressed is kept and the move is sent
        if (!move) {
          if (handOf(state).length < 3) {
            move = { final: true }
            return { label: "keep" }
          }
          move = { stage: "kept" }
          return { label: "keep", local: true, prepare: rest }
        }
        move.final = true
        return { label: "order" }
      }
      if (phase.kind === "turn" && phase.player === me) {
        if (!move) {
          const choice = choose(view, exercised)
          if (!choice) return null
          // `wanted` is the card the plan would like to press; `find` presses it when the hand holds it (a rig may not bring it: the other copies may all be played) and says which card it pressed in `type`
          const picks = RULE[choice.type] === "any" || (RULE[choice.type] === "other" && phase.targets.length > 0)
          move = { wanted: choice.type, type: choice.type, stage: "picked" }
          const prepare = async (table) => {
            await rest()
            if (choice.rig) await table.rig(choice.rig)
          }
          if (!picks) {
            move.final = true
            return { label: "play", prepare }
          }
          return { label: "card", local: true, prepare }
        }
        // after the card: a player to press (a Prince can always press its own player); for a Guard the window of the platform opens, where the player is pressed (`name`, unless there is one only, chosen already), then the character (`guess`), then Play (`play`)
        if (move.type === "guard") {
          if (move.stage === "picked" && phase.targets.length > 1) {
            move.stage = "named"
            return { label: "name", local: true, dom: { selector: '[role="dialog"] [data-field="player"] [role="radio"]', index: 0 } }
          }
          if (move.stage === "picked" || move.stage === "named") {
            move.stage = "guessed"
            return { label: "guess", local: true, dom: { selector: '[role="dialog"] [data-field="character"] [role="radio"]', index: 2 } }
          }
          move.final = true
          return { label: "validate", dom: { selector: '[role="dialog"] button[type="submit"]', index: 0 } }
        }
        move.final = true
        return { label: "target" }
      }
      move = null
      return null
    },
    // Where the controls lie, from what the board offers: the cards of the hand, held at the bottom left of the screen in the frame of the camera (so far above the table, y beyond 4, and told apart by their place across the screen), the Deal button below the columns of the middle (x within 4, z
    // between 0.6 and 1.6, lying on the table), and the area of a player, a `Hotspot` that lies at a card's height (y about 0.35) so that the whole area answers, cards included. A Guard's player and the nine characters are not on the table: they are in the platform's window (the plan's `dom`)
    find({ label, pressables, state }) {
      const world = (pressable) => pressable.world
      const inHand = (pressable) => world(pressable) && world(pressable)[1] > 4
      // a card that is still coming in from the deck is not in the hand yet, and a card in the air is pressed where it no longer is: `still` waits for the cards to have landed
      // (the plane under the whole table that takes a press where nothing answers, which the board lays while a card is picked, is no control of the middle: it is as wide as the table)
      const inMiddle = (pressable) => world(pressable) && Math.abs(world(pressable)[0]) < 4 && world(pressable)[2] > 0.6 && world(pressable)[2] < 1.6 && world(pressable)[1] < 0.1 && Math.max(pressable.size?.[0] ?? 0, pressable.size?.[2] ?? 0) < 20
      // a player's area is a large invisible plane at a card's height; the card the viewer has picked lies on the table in front of them, lifted to about the same height, and is no area (it is smaller: a card is about one unit wide)
      const isZone = (pressable) => world(pressable) && world(pressable)[1] > 0.3 && world(pressable)[1] < 0.4 && Math.max(pressable.size?.[0] ?? 0, pressable.size?.[2] ?? 0) > 2
      const byX = (a, b) => world(a)[0] - world(b)[0]
      const middle = pressables.filter(inMiddle).sort(byX)
      const cards = pressables.filter(inHand).sort((a, b) => (a.center?.[0] ?? 0) - (b.center?.[0] ?? 0))
      const zones = pressables.filter(isZone)
      const onHand = label === "card" || label === "play" || label === "keep" || label === "order"
      // a control is pressed once the ones it is picked from have not moved since the last look (`find` is asked every few tenths of a second): the cards that come in from the deck move for about a second, and a pixel that reaches one of them mid-way reaches another by the time it is pressed
      if (!still(onHand ? cards : label === "target" || label === "name" ? zones : middle)) return undefined
      if (onHand) {
        const hand = handOf(state)
        // only a card that can be pressed carries a control (the Countess rule leaves the other card of the hand with none), and the hand lies in the order of the cards: so the place of a card in the line of controls is its place among the cards that can be pressed, once every one
        // of them has landed (a card that came from the deck a moment ago, which a rig does, is in the air, and the control at its place in the line would be another card's)
        const playable = state.view.phase.kind === "keep" ? new Set(hand.map((card) => card.id)) : new Set(state.view.me.playable)
        const pressing = hand.filter((card) => playable.has(card.id))
        if (cards.length !== pressing.length) return undefined
        // the card to keep is the first, the one that goes under the deck first is the second
        if (label === "keep") return cards[0]
        if (label === "order") return cards[1]
        let index = move?.wanted ? pressing.findIndex((card) => card.type === move.wanted) : -1
        if (index < 0) index = 0
        if (move && pressing[index]) move.type = pressing[index].type
        return cards[index]
      }
      if (label === "deal") return middle.find((pressable) => Math.abs(world(pressable)[0]) < 0.3)
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
 * The card the viewer presses first: the one that exercises a control that has not been pressed yet, a Guard (a player, then one of the nine faces), a card that picks a player, the Chancellor (the card to keep and the card put back first: rigged into the hand when it is not there)
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
