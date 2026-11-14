// What the playground says about each part of the table: its name, a line of what it is, which group it belongs to, and the page of the docs that explains it. The controls list the parts from here, the search reads the words, and a test checks that every page and anchor
// linked here exists. Plain data: nothing here imports the table.

import { type PlayPart } from "../defaults"

export type PartGroup = "Cards" | "Board" | "Seats and score" | "Dice and chance" | "Numbers and counting" | "Writing and drawing" | "Maps and tiles"
export const GROUPS: readonly PartGroup[] = ["Cards", "Seats and score", "Board", "Dice and chance", "Numbers and counting", "Writing and drawing", "Maps and tiles"]

/** A page of the engine docs: `components/cards` is `docs/engine/02-components/04-cards.md`, the anchor a heading of it */
export type DocLink = { page: string; anchor?: string }
export const docHref = ({ page, anchor }: DocLink) => `/docs/engine/components/${page}${anchor ? `#${anchor}` : ""}`

export type PartInfo = { name: string; summary: string; group: PartGroup; doc: DocLink; keywords: string }

export const PARTS: Record<PlayPart, PartInfo> = {
  hand: { name: "Hand", summary: "The cards a player holds, as a fan, a row, a pile or a grid: along the near edge or in the bottom left of the screen. Drag a card out, drag one in.", group: "Cards", doc: { page: "zones", anchor: "hand" }, keywords: "cards fan row grid pile bottom left corner drag zone layout" },
  piles: { name: "Piles", summary: "A draw pile that deals a card when pressed, and a discard pile that takes the cards let go on it.", group: "Cards", doc: { page: "decks-and-piles", anchor: "pile" }, keywords: "deck draw discard deal reshuffle" },
  floor: { name: "Floor buttons", summary: "Hit, Stay and Deal drawn flat on the table, and a zone at each seat to press to give it a card. The rim lifts under the pointer.", group: "Cards", doc: { page: "floor-buttons" }, keywords: "hit stay deal zone hover lift flip 7 pad button" },
  stack: { name: "Stack", summary: "A stack of pieces: press it to take one off.", group: "Cards", doc: { page: "pieces" }, keywords: "coins pieces supply" },
  seats: { name: "Seats", summary: "Two to eight players round the table, each plate turned to face its player, the viewer at the bottom, the turn on one.", group: "Seats and score", doc: { page: "seats" }, keywords: "players plates ring turn crown aura avatar flip 7" },
  scoreboard: { name: "Scoreboard", summary: "The players' list at the top right of the table, the points written on the plates, the round, and a ticker of what happened.", group: "Seats and score", doc: { page: "score" }, keywords: "points total round standings hud ticker log" },
  board: { name: "Board", summary: "Cells to drop a card or a piece on: a grid of squares, a field of hexagons or a ring of spaces.", group: "Board", doc: { page: "boards" }, keywords: "grid hex hexagon squares cells ring loop chess drop" },
  track: { name: "Track", summary: "A line of spaces with a marker to move along it.", group: "Board", doc: { page: "tracks" }, keywords: "spaces marker path score track" },
  paper: { name: "Paper button", summary: "A sheet of paper to press: the turn written above it goes up.", group: "Board", doc: { page: "bets-and-choices" }, keywords: "turn end press button" },
  dice: { name: "Dice tray", summary: "Dice of any shape and number to roll in a tray.", group: "Dice and chance", doc: { page: "dice" }, keywords: "roll d6 d20 physics" },
  cup: { name: "Cup", summary: "A cup that covers, peeks, shakes, rests and pours. Press it to lift it.", group: "Dice and chance", doc: { page: "cups" }, keywords: "peek shake pour bluff liar" },
  bag: { name: "Bag", summary: "A bag of tokens: press it to draw one, which comes out of its mouth as a piece.", group: "Dice and chance", doc: { page: "bags" }, keywords: "draw tokens random" },
  counter: { name: "Counter", summary: "A number written on the table that counts up and down.", group: "Numbers and counting", doc: { page: "counters" }, keywords: "number score count" },
  stepper: { name: "Stepper", summary: "Two arrows round a count: press them, or hold to repeat.", group: "Numbers and counting", doc: { page: "bets-and-choices", anchor: "stepper" }, keywords: "plus minus arrows bet number" },
  slider: { name: "Slider", summary: "A rail with a knob to drag for a value, such as a bet.", group: "Numbers and counting", doc: { page: "bets-and-choices", anchor: "slider" }, keywords: "knob rail bet range" },
  timer: { name: "Timer", summary: "An hourglass that runs a step: start it, or run it out in four seconds.", group: "Numbers and counting", doc: { page: "timers" }, keywords: "sand clock turn limit" },
  fields: { name: "Fields", summary: "Fields written on the table: a text to write, a number to bet, a face to pick.", group: "Writing and drawing", doc: { page: "text-field" }, keywords: "text input clue bet choice prompt" },
  sketch: { name: "Sketch", summary: "A sheet to draw on with a colour and a brush, with undo and clear.", group: "Writing and drawing", doc: { page: "drawing" }, keywords: "draw pen brush strokes pictionary" },
  sheet: { name: "Sheet", summary: "A sheet of numbered boxes to tick, cross or circle.", group: "Writing and drawing", doc: { page: "sheets" }, keywords: "score sheet yahtzee boxes mark tick" },
  map: { name: "Map", summary: "Six cities and the roads between them: pick a city, claim a road, and the longest route is counted.", group: "Maps and tiles", doc: { page: "maps" }, keywords: "cities roads longest route ticket to ride catan" },
  tiles: { name: "Tiles", summary: "A table of tiles to lay where they fit, with the closed roads and cities counted.", group: "Maps and tiles", doc: { page: "tiles" }, keywords: "carcassonne lay tile turn landscape" },
}

/** The page of each group of tuning sliders: the component whose settings they are */
export const TUNING_DOCS: Record<string, DocLink> = {
  Card: { page: "cards", anchor: "settings" },
  Die: { page: "dice" },
  Piece: { page: "pieces" },
  Counter: { page: "counters" },
  Cup: { page: "cups" },
  Bag: { page: "bags" },
  Track: { page: "tracks" },
  Stepper: { page: "bets-and-choices", anchor: "stepper" },
  Slider: { page: "bets-and-choices", anchor: "slider" },
  Sketch: { page: "drawing" },
  Timer: { page: "timers" },
  Drag: { page: "dragging" },
  Seat: { page: "seats" },
}

/** Whether a text holds every word of the query, in any order and in any case: how the search of the playground matches */
export function matches(query: string, ...texts: readonly string[]): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = texts.join(" ").toLowerCase()
  return words.every((word) => haystack.includes(word))
}

/** The parts that answer a query, in the order of the catalog's groups */
export function filterParts(query: string): PlayPart[] {
  const all = Object.keys(PARTS) as PlayPart[]
  return GROUPS.flatMap((group) => all.filter((part) => PARTS[part].group === group && matches(query, PARTS[part].name, PARTS[part].summary, PARTS[part].keywords, group)))
}
