import type { PlayerResult, Results } from "@pbgo/engine-kit"
import { EASE_STANDARD, fade, travel, type Motion } from "./motion-preference"

/**
 * What the game-over panel (`components/game/game-over.tsx`) reads from the results, apart from the DOM: who is the hero, who is
 * in the ranking, how a score is written and when each part comes in. Pure, so the panel and the `/design` specimens agree.
 */

/** A player of the finished game as the panel shows them: the result, the name and the seat */
export type GameOverEntry = {
  result: PlayerResult
  nickname: string
  /** The seat colour */
  color: string
  /** The account's picture (PLT-13); absent: the avatar is generated */
  imageUrl?: string | null
}

/** The players of a finished game as the panel shows them: the winners as the hero, the others as the ranking (by rank, a tie keeps the seat order). */
export function splitResults(results: Results): { winners: PlayerResult[]; others: PlayerResult[] } {
  const won = (result: PlayerResult) => results.winners.includes(result.playerId)
  return {
    winners: results.players.filter(won),
    others: results.players.filter((result) => !won(result)).sort((a, b) => a.rank - b.rank),
  }
}

/** A player's points with a "+" in front of a gain: "+10 pts", "0 pts", "-3 pts". `format` writes the points in the visitor's language. */
export const pointsLine = (points: number, format: (points: number) => string) => `${points > 0 ? "+" : ""}${format(points)}`

/** A number with its "+" when it is a gain, for the score chips: "+3", "0", "-2" */
export const signed = (n: number) => pointsLine(n, String)

/**
 * Seconds, with lively motion: the panel settles, the hero comes in, the points count up, then the ranking rows follow one after
 * the other. Calm and reduced motion have none of it: the panel comes in whole.
 */
export const GAME_OVER_TIMING = {
  /** The hero's parts start together with this offset between them */
  hero: 0.2,
  /** The count-up of the points */
  count: 0.9,
  /** First ranking row, after the panel has settled */
  rows: 0.55,
  /** Between two rows */
  step: 0.09,
  /** Rows after this one all come in together, so a long table is not slow to read */
  maxSteps: 6,
} as const

/** When the nth ranking row comes in (seconds) */
export const rowDelay = (index: number) => GAME_OVER_TIMING.rows + Math.min(Math.max(index, 0), GAME_OVER_TIMING.maxSteps) * GAME_OVER_TIMING.step

/**
 * How the panel comes in and goes out as a whole: a spring that settles with lively motion, a short slide with calm motion, a
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
