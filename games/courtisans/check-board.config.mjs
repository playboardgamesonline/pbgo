// What only Courtisans knows about its board, for `pnpm check:board courtisans` (`docs/scripts.md`): how many seats are checked, the situations the windows are photographed in, what the viewer presses and the cases that the engine's debug commands rig.
// The tool does the rest (seats, windows, frames, reload, the start, an absent player). Plain JavaScript, read by Node: no import of the game's code, since the board's files are TypeScript for the bundler.

// The other seats, and the viewer when the plan has nothing to press, play with the engine's own player (`turn`): it reads the missions and plays a whole turn, as an absent player would be played. A game is a few dozen moves long.
const engine = () => null

// Where the controls of the board lie, from what the board offers: the world is the table's, x to the right and z toward the viewer (`world` is the middle of a control, `size` its extent along x, y and z)
/** A card of the hand: held in front of the camera, high above the table */
const isHandCard = (pressable) => pressable.world !== null && pressable.world[1] > 3
/** An area that takes a press over the table: a lane of the Queen's table, or a domain with its plate */
const isArea = (pressable) => pressable.world !== null && Math.abs(pressable.world[1] - 0.35) < 0.05
const isLane = (pressable) => isArea(pressable) && pressable.size[0] < 2.5 && pressable.size[2] < 3.5
/** The area of the viewer's own domain lies in front of them, the areas of the others are every other that is not a lane */
const isMyDomain = (pressable) => isArea(pressable) && !isLane(pressable) && pressable.world[2] > 5
const isTheirDomain = (pressable) => isArea(pressable) && !isLane(pressable) && pressable.world[2] <= 5
/** The button of the table (it says nobody is eliminated while an assassin is played, and skips the end of the game): right of the cards of the Queen's table, below the draw pile */
const isButton = (pressable) => pressable.world !== null && Math.abs(pressable.world[0] - 7.7) < 0.6 && Math.abs(pressable.world[2] - 4.3) < 0.6 && pressable.world[1] < 1
/** A card of the Queen's table, which an assassin may eliminate: a card lying beyond the edge of the mat, not the missions at rest at the viewer's side */
const isTableCard = (pressable) => pressable.world !== null && pressable.world[1] < 1 && Math.abs(pressable.world[2]) > 1.4 && Math.abs(pressable.world[2]) < 6 && !isArea(pressable) && !isButton(pressable)

/** What the plan has begun for a table and not finished, by the code of the table: a card is picked before it is played, an assassin is played before its victim is chosen */
const flows = new Map()

/**
 * A control is pressed once it has not moved since the last look (`find` is asked every few tenths of a second): the cards that come in from the draw pile fly for about a second, and a pixel read in the air is where the card no longer is when the press lands.
 * The last look of each control, by the code of the table and what is looked for
 */
const looks = new Map()
function still(state, label, pressable) {
  if (!pressable?.pixel) return undefined
  const key = `${state.code}:${label}`
  const before = looks.get(key)
  looks.set(key, pressable.pixel)
  return before && Math.hypot(before[0] - pressable.pixel[0], before[1] - pressable.pixel[1]) < 1.5 ? pressable : undefined
}

/** The cards of the Queen's table that an assassin may eliminate: every one but a guard */
const eliminable = (view) => view.table.some((placed) => placed.card.role !== "guard")

/** The control that a label stands for, from what the board offers: undefined while it does not show it */
function where({ label, pressables, state }) {
  const flow = flows.get(state.code)
  switch (label) {
    case "card": {
      // the cards of the hand are laid in order from the left of the screen: they are the hand when the board holds as many as the table does (a card that has just been played or drawn is still on its way)
      const hand = state.view.me?.hand ?? []
      const cards = pressables.filter(isHandCard).sort((a, b) => a.world[0] - b.world[0])
      return cards.length === hand.length ? cards[hand.findIndex((card) => card.id === flow?.cardId)] : undefined
    }
    case "assassin-lane":
    case "light":
      return pressables.find((pressable) => isLane(pressable) && pressable.world[2] < 0)
    case "disgrace":
      return pressables.find((pressable) => isLane(pressable) && pressable.world[2] > 0)
    case "domain":
      return pressables.find(isMyDomain)
    case "opponent-domain":
      return pressables.find(isTheirDomain)
    case "victim":
      return pressables.find(isTableCard)
    case "no-assassination":
      return pressables.find(isButton)
    default:
      return undefined
  }
}

const config = {
  // The three layouts of the seats: one across the table, one at each side, and the two across with the two at the sides
  players: [2, 4, 5],
  // The first window is a large one: the platform's cookie banner floats over the bottom of the board until it is answered, and in a smaller window the third card of the hand and the missions at rest lie under it. The others are the tool's own
  sizes: ["1920x1080", "1280x800", "1280x720", "1440x900", "2560x1080", "1024x640", "1024x768", "900x600", "1024x1366", "900x1200"],
  bot: engine,
  // a few turns are played before a reload or an absence, so that there are cards in the domains and on the Queen's table, and a count under each draw
  warm: 9,

  // The situations the windows are photographed in: the first turn of the banquet, and the viewer's turn once every domain holds cards (the plates, the hands, the piles and the missions at rest all at work). Both are reached by playing the table on with the engine's player
  scenes: {
    async turn(table) {
      await table.advance({ until: (state, who) => who === 0 && state.view.phase === "playing", label: "the first turn of the viewer" })
    },
    async crowded(table) {
      await table.advance({ until: (state, who) => who === 0 && state.view.phase === "playing" && state.view.players.every((player) => player.domain.length >= 4), label: "every domain holds cards" })
    },
  },

  // What the viewer presses, in the order the game offers it: a card of the hand, then where it is played (a lane of the Queen's table above or below the mat, their own domain, the domain of another player), and for an assassin the victim among the cards of the
  // Queen's table or the button that says nobody. A card is picked before it is played, so the pick is `local`: the table does not move. The missions are read through the API on the way
  presses: {
    expect: ["card", "light", "disgrace", "domain", "opponent-domain", "victim", "no-assassination"],
    max: 80,
    budgetSeconds: 240,
    bot: engine,
    plan({ state, table, exercised }) {
      const { view } = state
      if (view.phase !== "playing") return null
      const code = table.code
      // The table moved since the flow began: the card was sent, or the turn passed
      if (flows.get(code) && flows.get(code).version !== state.version) flows.delete(code)
      const flow = flows.get(code)
      const hand = view.me?.hand ?? []
      if (flow) {
        if (flow.stage === "picked") {
          flow.stage = flow.assassin ? "played" : "sent"
          // An assassin played on the Queen's table opens the choice of the victim, which is made on the board: the press only changes what it offers
          return { label: flow.assassin ? "assassin-lane" : flow.kind, local: flow.assassin }
        }
        if (flow.stage === "played") {
          flow.stage = "sent"
          return { label: flow.kind }
        }
        return null
      }
      const zones = view.availableZones
      const assassin = hand.find((card) => card.role === "assassin")
      const victim = !!assassin && zones.includes("table") && eliminable(view)
      const wanted = [
        ["no-assassination", victim],
        ["victim", victim],
        ["light", zones.includes("table")],
        ["disgrace", zones.includes("table")],
        ["domain", zones.includes("domain")],
        ["opponent-domain", zones.includes("opponentDomain")],
      ].find(([label, possible]) => possible && !exercised.has(label))
      if (!wanted) return null
      const [kind] = wanted
      const assassination = kind === "victim" || kind === "no-assassination"
      const card = assassination ? assassin : (hand.find((one) => one.role !== "assassin") ?? hand[0])
      flows.set(code, { version: state.version, stage: "picked", kind, assassin: assassination, cardId: card.id })
      return { label: "card", local: true }
    },
    find: ({ label, pressables, state }) => still(state, label, where({ label, pressables, state })),
  },

  // The cases of the Rig the table folder of the debug panel, each recorded as frames: one table serves all of them, `turn` and `over` after. The missions are read and the banquet begins
  scenarios: {
    missions: ({ table, record }) => record(() => table.rig("missions"), { seconds: 5 }),
  },
}

export default config
