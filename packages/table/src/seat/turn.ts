import type { GameStatus } from "@pbgo/core/lib/game-types"

/** Whose turn it is, as the table says it: the viewer is one of the players the game waits for, or it waits for one other player, or for several others at once */
export type WhoseTurn = { kind: "you" } | { kind: "turn"; id: string } | { kind: "waiting"; ids: readonly string[] }

/**
 * Who the game waits for, from what the table says (`status`, `waitingFor`, `meId` of `PublicGame`): the viewer when they are one of those waited for, a classic turn (one player) else, and the players it waits for together when the viewer is not one of them, on a simultaneous step.
 * Nobody before the game starts, after it is over or when it waits for nobody. This is the rule of the ticker at the top left of the screen, kept in one place for the table.
 */
export function whoseTurn({ status, waitingFor, meId }: { status: GameStatus; waitingFor: readonly string[]; meId: string | null }): WhoseTurn | null {
  if (status !== "playing" || waitingFor.length === 0) return null
  if (meId !== null && waitingFor.includes(meId)) return { kind: "you" }
  if (waitingFor.length === 1) return { kind: "turn", id: waitingFor[0]! }
  return { kind: "waiting", ids: waitingFor }
}

/** The platform's words the turn line reads, by their `UI_TEXTS` key: `t` of `useText()` is one */
export type TurnWords = (key: "yourTurn" | "turnOf" | "waitingFor", params?: Record<string, string>) => string

/** The sentence that says whose turn it is, in the visitor's language: the platform's own words with the names put in (`nameOf` gives a name as it is drawn, `shortName` of the nickname); `null` for nobody */
export function turnSentence(turn: WhoseTurn | null, words: TurnWords, nameOf: (id: string) => string): string | null {
  if (!turn) return null
  if (turn.kind === "you") return words("yourTurn")
  if (turn.kind === "turn") return words("turnOf", { name: nameOf(turn.id) })
  return words("waitingFor", { names: turn.ids.map(nameOf).join(", ") })
}

/** How wide a letter of the table's lettering is, as a share of its height: the bold rounded font a table writes in */
const LETTER = 0.62

/** The distance between the middles of two lines of a sentence, as a share of the height of a letter */
export const LINE_LEADING = 1.2

/** A sentence as it is set on the table: its lines, and the height of its letters */
export type SetLine = { lines: string[]; height: number }

/**
 * How a sentence is set where it may be at most `maxWidth` wide (no limit when it is left out): on one line at `height` when it fits; else on two, broken at the space that leaves the lines the most alike, so that "Waiting for Ann, Bob, Cyd" is not written in
 * smaller letters than "Ann's turn"; else, a sentence that still does not fit, in letters small enough to. The letters keep the height asked for as long as the room allows, whatever the words are.
 */
export function setLine(text: string, height: number, maxWidth?: number): SetLine {
  const letters = (line: string) => Array.from(line).length
  if (maxWidth === undefined || letters(text) * LETTER * height <= maxWidth) return { lines: [text], height }
  const words = text.split(" ")
  let lines = [text]
  let longest = letters(text)
  for (let at = 1; at < words.length; at++) {
    const pair = [words.slice(0, at).join(" "), words.slice(at).join(" ")]
    const widest = Math.max(...pair.map(letters))
    if (widest < longest) {
      lines = pair
      longest = widest
    }
  }
  return { lines, height: Math.min(height, maxWidth / (longest * LETTER)) }
}
