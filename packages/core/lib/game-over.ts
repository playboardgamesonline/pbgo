import { outcomesOf, type PlayerResult, type Results } from "@pbgo/engine-kit"
import type { CoreView } from "./binding"
import type { PublicGame } from "./game-types"
import { EASE_STANDARD, fade, travel, type Motion } from "./motion-preference"
import { DEFAULT_SKIN, fill } from "./skin"

/**
 * What the end screen (`components/game/game-over.tsx`) reads from the results, apart from the DOM: how the game ended for the visitor, who comes where and how a score is written. Pure, so the screen and the specimens of the
 * design docs agree.
 */

/**
 * How the end is told: a victory, or the defeat of a table that lost together (`coop: "lost"` in the results), which has nobody to crown and nothing to celebrate.
 * A game where the players play against each other always names a winner, so it never ends in a defeat.
 */
export function endingOf(results: Results): "victory" | "defeat" {
  return results.coop === "lost" ? "defeat" : "victory"
}

/** A player of the finished game as the end screen shows them: the result, the name and the seat */
export type GameOverEntry = {
  result: PlayerResult
  nickname: string
  /** The seat colour */
  color: string
  /** The account's picture (PLT-13); absent: the avatar is generated */
  imageUrl?: string | null
}

/** The players of a finished game from the first place to the last: a tie keeps the seat order. */
export const rankedResults = (results: Results): PlayerResult[] => [...results.players].sort((a, b) => a.rank - b.rank)

/** A step of the podium: the players who share a rank, so a tie, the members of a team, or the whole table of a game that is played together. */
export type Place = { rank: number; results: PlayerResult[] }

/**
 * The places of a finished game from the first to the last. Players who share a rank share a place: that is how a tie is told, how a game with teams tells which team each player was on (the members of a team have the rank of their team) and how a game
 * that is played together tells that the table won or lost as one (everybody is first). The place keeps the rank, so that the step after a tie for the first place is the third, as it was written.
 */
export function placesOf(results: Results): Place[] {
  const places: Place[] = []
  for (const result of rankedResults(results)) {
    const last = places.at(-1)
    if (last && last.rank === result.rank) last.results.push(result)
    else places.push({ rank: result.rank, results: [result] })
  }
  return places
}

/** A place in words: "1st", "2nd", "3rd", "4th", "11th", "22nd". */
export function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`
}

/** Whether the game counts points: some player has a score or a line of detail. A game won by an event, with nothing to add up, has none to show. */
export const scoredOf = (results: Results): boolean => results.players.some((player) => player.total !== 0 || player.detail.length > 0)

/** How the game ended for the visitor, for the head of the end screen. */
export type Summary = {
  /** What the screen says first: "You won", "Draw", "2nd place" (at a table of more than two, "You lost" at one of two), "Victory" or "Defeat" for a table that plays together. */
  title: string
  /** Won, lost or drawn, for the mark that goes with the title. */
  outcome: "win" | "loss" | "draw"
  /** Where they came, null for a table that plays together (everybody is first). */
  place: number | null
  /** How many played. */
  of: number
  /** Their score, null for a game that does not count points. */
  points: number | null
}

/** How the game ended for `playerId`. A visitor the results do not name (they are not one of the players) is told only that it is over. */
export function summaryOf(results: Results, playerId: string | null): Summary {
  const of = results.players.length
  const mine = results.players.find((player) => player.playerId === playerId)
  if (!mine) return { title: "Game over", outcome: "draw", place: null, of, points: null }
  const points = scoredOf(results) ? mine.total : null
  const outcome = outcomesOf(results).find((entry) => entry.playerId === mine.playerId)?.outcome
  switch (outcome) {
    case "coop_win":
      return { title: "Victory", outcome: "win", place: null, of, points }
    case "coop_loss":
      return { title: "Defeat", outcome: "loss", place: null, of, points }
    case "win":
      return { title: "You won", outcome: "win", place: mine.rank, of, points }
    case "draw":
      return { title: "Draw", outcome: "draw", place: mine.rank, of, points }
    default:
      return { title: of > 2 ? `${ordinal(mine.rank)} place` : "You lost", outcome: "loss", place: mine.rank, of, points }
  }
}

function hash(text: string) {
  let h = 0
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) | 0
  return Math.abs(h)
}

const defaultPointsText = (points: number) => fill(DEFAULT_SKIN.texts.pointsShort, { points })

/**
 * What a board announces when the game is over, and with which kind of announcement (`kind`: `"victory"`, or `"defeat"` for a table that lost together, `endingOf`).
 * A victory: a sentence picked from the skin's phrases with a deterministic hash (everyone sees the same one). Template `{pseudo}` / `{points}`: the announcement keeps what comes
 * before `{pseudo}`, the names and points go in the subtitle. A defeat: `defeatText` (the skin's `defeatTitle`) and the table's points, with nobody to show.
 * `pointsText` writes the points in that subtitle: pass `(points) => t("pointsShort", { points })` for the visitor's language (default: English).
 * `winners`: their player ids, in ranking order (for the medallions of the victory announcement, `seatsOf`).
 */
export function winnerAnnouncement(
  game: PublicGame,
  view: CoreView,
  phrases: string[] = DEFAULT_SKIN.victoryPhrases,
  pointsText = defaultPointsText,
  defeatText = DEFAULT_SKIN.texts.defeatTitle,
): { phrase: string; detail: string; winners: string[]; kind: "victory" | "defeat" } {
  const results = view.results
  if (!results) return { phrase: "", detail: "", winners: [], kind: "victory" }
  if (endingOf(results) === "defeat") return { phrase: defeatText, detail: pointsText(results.players[0]?.total ?? 0), winners: [], kind: "defeat" }
  const winners = results.players.filter((j) => results.winners.includes(j.playerId))
  // Varies from one game of a table to the next: the length of the view's own log, or, for a game that keeps its history in the log of the table, the version of its last move
  const template = phrases[hash(game.code + (view.log?.length ?? game.log?.at(-1)?.v ?? 0)) % phrases.length] ?? ""
  const phrase = template.split("{pseudo}")[0]!.replace("{points}", String(winners[0]?.total ?? 0)).replace(/[\s:,–-]+$/, "").trim()
  const names = winners.map((v) => game.players.find((j) => j.id === v.playerId)?.nickname).join(" & ")
  return { phrase, detail: `${names} · ${pointsText(winners[0]?.total ?? 0)}`, winners: winners.map((v) => v.playerId), kind: "victory" }
}

/** A score as the end screen writes it: "1 pt", "9 pts", "-3 pts". */
export const scoreText = (points: number): string => `${points} ${Math.abs(points) === 1 ? "pt" : "pts"}`

/** A player's points with a "+" in front of a gain: "+10 pts", "0 pts", "-3 pts". `format` writes the points in the visitor's language. */
export const pointsLine = (points: number, format: (points: number) => string) => `${points > 0 ? "+" : ""}${format(points)}`

/** A number with its "+" when it is a gain, for the score chips: "+3", "0", "-2" */
export const signed = (n: number) => pointsLine(n, String)

/**
 * How the end screen comes in and goes out as a whole: a spring that settles with lively motion, a short slide with calm motion, a
 * fade of 150 ms at most with reduced motion (no slide, no scale).
 */
export function sectionMotion(motion: Motion) {
  const lively = motion === "lively"
  const away = { opacity: 0, y: travel(motion, lively ? 24 : 12), scale: lively ? 0.97 : 1 }
  return {
    initial: away,
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: away,
    transition: lively ? ({ type: "spring", stiffness: 200, damping: 24 } as const) : { duration: fade(motion, 0.3), ease: EASE_STANDARD },
  }
}
