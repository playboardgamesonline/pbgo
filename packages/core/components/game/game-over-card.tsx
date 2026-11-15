"use client"

import { ArrowDown01Icon, ArrowRight01Icon, ArrowUp01Icon, RepeatIcon, Share08Icon, SparklesIcon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { AnimatePresence, motion as animated } from "motion/react"
import { useId, useState } from "react"
import { pointsLabel, pointsTone } from "@pbgo/ui/results"
import { cn } from "@pbgo/ui/utils"
import { rewardsMotion, scoreText, sectionMotion, type Summary } from "../../lib/game-over"
import type { Motion } from "../../lib/motion-preference"
import type { RankChange } from "../../lib/rank-change"
import { rematchLine, type Rematch } from "../../lib/rematch"
import { gameOverStyle, type GameOverTheme, type SeatTheme } from "../../lib/ui-theme"
import { PrimaryButton } from "../home/screen"
import { HistoryPanel, ScoresPanel, StatsPanel, TabBar, TabPanel, type GameOverTab } from "./game-over-panels"
import { ACCENT, Crowned, Faces, inSeatColour, namesOf, type CrownMark, type PodiumPlace, type ResultDetailRenderer } from "./game-over-parts"
import type { HistoryTurn } from "./ticker"

export type { GameOverTab } from "./game-over-panels"
export type { PodiumPlace, ResultDetailRenderer } from "./game-over-parts"

// The end screen, in the game's look: a card centered on the screen, over the board with no veil around it. It wears what a game gives its screens: the surface, line, corners and ink of `UI_THEME.gameOver`, the ring and the name colours of `UI_THEME.seat`
// (the pictures are always round), the game's fonts, its crown and its buttons (`PrimaryButton`). From the top: how the game ended for the visitor, with what it gave them (the rank points of a game that counted for the rank, the experience); a podium with
// the winner in the middle, the second place on its left and the third on its right, on steps that touch each other (at two places the steps share the whole width; players who share a rank share a step, a tie or a team; a table that plays together has one
// place for everybody); then the details in tabs: the scores of every player in a table (always, and first), and, for a game that gives its history, the statistics and the history itself; then two buttons: "Continue", which leaves the finished game for the
// platform, and "Rematch", which asks the table for another game and says who has agreed. Pure presentation, no game context: the connected `GameOver` feeds it from the game, the design docs with samples. The names and the score lines are what the
// players and the game wrote; every other word is English until the language pass.

/** A reward under the title: the rank points and the experience a game gave the visitor. */
const REWARD = "inline-flex h-8 items-center gap-2 rounded-lg border border-current/15 bg-current/10 px-3 font-display text-sm font-bold tabular-nums"

/** The height of the steps, which touch each other: the first place is the highest, and each step after it is lower. */
const STEP_HEIGHTS = ["min-h-24", "min-h-[4.75rem]", "min-h-[3.75rem]"] as const
/**
 * How the steps stand for one, two or three places. The first place is in the middle of three; at two the steps share the whole width, the second on the left of the first; a single place takes it all. The classes are written out for the stylesheet to find them.
 */
const LAYOUT = {
  1: { grid: "grid-cols-1", columns: ["col-start-1"] },
  2: { grid: "grid-cols-2", columns: ["col-start-2", "col-start-1"] },
  3: { grid: "grid-cols-3", columns: ["col-start-2", "col-start-1", "col-start-3"] },
} as const

type PlaceProps = { place: PodiumPlace; winners: readonly string[]; meId: string | null; scored: boolean; seat: SeatTheme; crown: CrownMark }

/**
 * One step of the podium: the players stand on it (the crown of a winner above their pictures), and the name (or the name of the team and the names of its players under it) and the score are written on its face. The steps touch each other, so that
 * together they make one podium, and none of them has a number.
 */
function Step({ place, index, count, winners, meId, scored, seat, crown }: PlaceProps & { index: number; count: 1 | 2 | 3 }) {
  const { entries } = place
  const first = index === 0
  const alone = first && entries.length === 1
  const coloured = inSeatColour(seat, entries)
  return (
    <li className={cn("row-start-1 flex min-w-0 flex-col items-center justify-end", LAYOUT[count].columns[index])}>
      <div className="flex flex-col items-center gap-1 pb-2 short:pb-1">
        {entries.some((entry) => winners.includes(entry.result.playerId)) && <Crowned crown={crown} className="short:hidden" />}
        <Faces entries={entries} seat={seat} className={alone ? "size-14 text-2xl" : entries.length > 2 ? "size-8 text-sm" : "size-11 text-lg"} />
      </div>
      <div
        className={cn(
          "flex w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-t-lg border border-b-0 border-current/15 bg-gradient-to-b px-2 py-2 text-center short:min-h-0 short:py-1.5",
          first ? "from-current/20 to-current/[0.06]" : "from-current/[0.12] to-current/[0.04]",
          STEP_HEIGHTS[index] ?? "min-h-12",
        )}
      >
        <p
          className={cn("ph-mask line-clamp-2 w-full font-sans leading-tight font-black tracking-[0.1em] text-balance uppercase [overflow-wrap:anywhere]", first ? "text-base" : "text-sm", coloured && "brightness-150")}
          style={coloured ? { color: entries[0]!.color } : undefined}
        >
          {place.label ?? namesOf(entries, meId)}
        </p>
        {place.label && <p className="ph-mask line-clamp-2 w-full font-sans text-xs text-balance opacity-60">{namesOf(entries, meId)}</p>}
        {scored && entries[0] && (
          <p className={cn("font-display tabular-nums", first ? "text-xl" : "text-base opacity-80")} style={first ? ACCENT : undefined}>
            {scoreText(entries[0].result.total)}
          </p>
        )}
      </div>
    </li>
  )
}

/** The podium: the first three places on steps that touch each other. The places after the third have no step: they are in the table of the scores, with everybody else. */
function Podium({ places, ...rest }: Omit<PlaceProps, "place"> & { places: PodiumPlace[] }) {
  const steps = places.slice(0, 3)
  const count = steps.length as 1 | 2 | 3
  if (steps.length === 0) return null
  return (
    <ol aria-label="Podium" className={cn("mx-auto grid w-full max-w-md shrink-0 items-end border-b border-current/20 short:hidden", LAYOUT[count].grid)}>
      {steps.map((place, index) => (
        <Step key={place.rank} place={place} index={index} count={count} {...rest} />
      ))}
    </ol>
  )
}

/** A table that plays together: no steps, since nobody beat anybody. Everybody stands in one place, crowned when the table won and not when it lost. */
function Together({ place, won, meId, scored, seat, crown }: { place: PodiumPlace; won: boolean; meId: string | null; scored: boolean; seat: SeatTheme; crown: CrownMark }) {
  const { entries } = place
  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5 short:hidden">
      {won && <Crowned crown={crown} />}
      <Faces entries={entries} seat={seat} className={entries.length > 3 ? "size-11 text-lg" : "size-14 text-2xl"} />
      <p className="ph-mask w-full text-center font-sans text-base leading-tight font-black tracking-[0.1em] text-balance uppercase">{place.label ?? namesOf(entries, meId)}</p>
      {scored && entries[0] && (
        <p className="font-display text-xl tabular-nums" style={ACCENT}>
          {scoreText(entries[0].result.total)}
        </p>
      )}
    </div>
  )
}

/**
 * What the game gave the visitor, under the title: the rank points of a game that counted for the rank, with the mark that says so, and the experience (whatever the mode), each once it is known. Nothing for a guest, who has neither, and nothing while
 * the game is not written down. The row opens when there is something to say, so that the card grows without a jump.
 */
function Rewards({ rank, motion }: { rank?: RankChange | null; motion: Motion }) {
  const ranked = !!rank?.ranked
  const points = ranked && rank.points !== null ? rank.points : null
  const xp = rank?.recorded && rank.xp && rank.xp > 0 ? rank.xp : null
  const tone = pointsTone(points)
  return (
    <AnimatePresence initial={false}>
      {(ranked || xp !== null) && (
        <animated.div key="rewards" {...rewardsMotion(motion)} className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-center gap-2 py-0.5">
            {ranked && (
              <span className={REWARD}>
                <span className="font-sans text-xs font-semibold tracking-[0.16em] uppercase opacity-70">Ranked</span>
                {points !== null && (
                  <>
                    <span aria-hidden className="h-4 w-px bg-current/20" />
                    <span className={cn("inline-flex items-center gap-1", tone === "destructive" && "opacity-70")} style={tone === "success" ? ACCENT : undefined}>
                      <HugeiconsIcon icon={points < 0 ? ArrowDown01Icon : ArrowUp01Icon} strokeWidth={2.2} className="size-4" />
                      {pointsLabel(points)}
                    </span>
                    <span className="font-sans text-xs font-medium opacity-60">rank points</span>
                  </>
                )}
              </span>
            )}
            {xp !== null && (
              <span className={REWARD} style={ACCENT}>
                <HugeiconsIcon icon={SparklesIcon} strokeWidth={2} className="size-4" />
                +{xp} XP
              </span>
            )}
          </div>
        </animated.div>
      )}
    </AnimatePresence>
  )
}

export type GameOverCardProps = {
  /** The game's look for the card (`UI_THEME.gameOver` over its defaults, `gameOverTheme`). */
  theme: GameOverTheme
  /** The game's look for the pictures of its players (`UI_THEME.seat` over its defaults, `seatTheme`). */
  seat: SeatTheme
  /** The skin's pattern, faint on the card. */
  pattern?: string | null
  /** The mark of a winner (the skin's host icon or a crown), drawn at the size classes it is given; it takes the colour of the text it sits in, which the card sets to its accent. */
  crown: CrownMark
  /** How the game ended for the visitor. */
  summary: Summary
  /** The places from the first to the last: the players who share a rank share a place, and a table that plays together has a single one. */
  places: PodiumPlace[]
  /** The ids of the winners: nobody for a table that lost together. */
  winners: readonly string[]
  /** The table plays together and won or lost as one: the podium gives way to one place for everybody. */
  together?: "won" | "lost"
  /** The visitor's player id. */
  meId: string | null
  /** What the game gave the visitor: its rank points when it counted for the rank, and the experience ("+N XP", whatever the mode). Absent for a guest, and while it is not known. */
  rank?: RankChange | null
  /**
   * The history of the game as the board gives its ticker (`groupTurns`: the newest turn first, each move rendered by the game). With it the card has its statistics and its history; without it, the table of the scores is all that lies under the podium.
   */
  history?: readonly HistoryTurn[]
  /** The lines of the history say who did what themselves (the ticker's `sentences`: `Ben plays Duke`), so the history shows the player's picture before a line and no name. */
  sentences?: boolean
  /** The tab that is open to begin with: the scores. */
  defaultTab?: GameOverTab
  /** Where the vote for another game stands. */
  rematch: Rematch
  /** The vote of the visitor is being sent. */
  voting?: boolean
  /** Asks the table for another game. Absent: the button is off. */
  onRematch?: () => void
  /** Leaves the finished game for the platform. Absent: the button is off. */
  onContinue?: () => void
  /** Opens the share window of the result. Absent while its picture is being drawn. */
  onShare?: () => void
  renderDetail?: ResultDetailRenderer
  /** How much it moves: `useMotion()` in a game, picked by hand in a specimen. */
  motion: Motion
  className?: string
}

/**
 * The end screen: how the game ended for the visitor at the very top with what it gave them, the podium under it, the details in tabs (the scores of every player, the statistics, the history) and the two buttons. The score of a game that counts no points
 * is not written, and neither are the lines under it. `Rematch` says how many of the players still at the table agreed, and a line under the buttons says who asked, whom the table waits for and who left (`rematchLine`).
 */
export function GameOverCard({ theme, seat, pattern, crown, summary, places, winners, together, meId, rank, history, sentences, defaultTab = "scores", rematch, voting = false, onRematch, onContinue, onShare, renderDetail, motion, className }: GameOverCardProps) {
  const base = useId()
  const [chosen, setChosen] = useState<GameOverTab>(defaultTab)
  const scored = summary.points !== null
  const line = rematchLine(rematch)
  const here = rematch.agreed.length + rematch.waiting.length
  // The count of the players who agreed means something while another game can still be played
  const asked = rematch.agreed.length > 0 && rematch.enough
  const entries = places.flatMap((place) => place.entries)
  // The statistics and the history are the game's history told: a game that gives none has the table of the scores only
  const tabs: GameOverTab[] = history && history.length > 0 ? ["scores", "stats", "history"] : ["scores"]
  const tab = tabs.includes(chosen) ? chosen : "scores"
  // A picture of a player is always round, whatever shape the game gives the seats on its table; the ring and the colour of the names stay the theme's
  const faces: SeatTheme = { ...seat, shape: "disc" }
  const panel =
    tab === "stats" && history ? (
      <StatsPanel places={places} scored={scored} history={history} seat={faces} motion={motion} />
    ) : tab === "history" && history ? (
      <HistoryPanel history={history} entries={entries} meId={meId} seat={faces} sentences={sentences} />
    ) : (
      <ScoresPanel places={places} winners={winners} meId={meId} scored={scored} together={together} seat={faces} crown={crown} renderDetail={renderDetail} />
    )
  return (
    <animated.section
      aria-label="Game result"
      {...sectionMotion(motion)}
      className={cn("pointer-events-auto relative flex max-h-full w-full max-w-2xl flex-col border-[0.5px] font-sans shadow-[0_24px_70px_rgb(0_0_0/65%)] short:max-w-xl", className)}
      style={gameOverStyle(theme)}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        {pattern && <div className="absolute inset-0 bg-[length:128px_128px] opacity-[0.07]" style={{ backgroundImage: `url(${pattern})` }} />}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgb(255_255_255/9%),transparent_65%)]" />
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col gap-4 px-6 pt-6 pb-5 short:gap-2 short:px-5 short:py-3">
        <button
          type="button"
          aria-label="Share the result"
          title="Share the result"
          disabled={!onShare}
          onClick={onShare}
          className="absolute top-3 right-3 grid size-9 cursor-pointer place-items-center rounded-md opacity-70 transition-opacity hover:opacity-100 disabled:cursor-wait disabled:opacity-30 motion-reduce:transition-none"
        >
          <HugeiconsIcon icon={Share08Icon} strokeWidth={1.8} className="size-5" />
        </button>

        {/* How it ended for the visitor comes first, at the very top of the card, with what it gave them; the share is in the corner beside it */}
        <header className="flex shrink-0 flex-col items-center gap-2">
          <h2 className="px-9 text-center font-display text-4xl leading-tight tracking-wide short:text-2xl" style={summary.outcome === "win" ? ACCENT : undefined}>
            {summary.title}
          </h2>
          <Rewards rank={rank} motion={motion} />
        </header>

        {together ? (
          <Together place={places[0] ?? { rank: 1, entries: [] }} won={together === "won"} meId={meId} scored={scored} seat={faces} crown={crown} />
        ) : (
          <Podium places={places} winners={winners} meId={meId} scored={scored} seat={faces} crown={crown} />
        )}

        {/* The details of the game: the scores first, and, for a game that gives its history, the statistics and the history. The height is the same on every tab, so that the card does not move when one is picked */}
        <section
          aria-label="Details of the game"
          className="@container flex min-h-32 shrink basis-60 flex-col overflow-hidden rounded-xl border border-current/15 bg-current/[0.04] short:min-h-20 short:basis-40 [@media(min-height:56rem)]:basis-80"
        >
          {tabs.length > 1 ? (
            <>
              <TabBar tabs={tabs} value={tab} onChange={setChosen} base={base} labels={{ scores: scored ? "Scores" : "Ranking", stats: "Stats", history: "History" }} motion={motion} />
              <TabPanel base={base} tab={tab} motion={motion}>
                {panel}
              </TabPanel>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">{panel}</div>
          )}
        </section>

        <div className="flex shrink-0 flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2">
            <PrimaryButton
              onClick={onRematch}
              busy={voting}
              waiting={rematch.mine}
              disabled={!onRematch || !rematch.enough}
              className="h-12 max-w-none border border-current/30 bg-current/10 px-4 text-xl text-inherit shadow-none hover:scale-100 hover:bg-current/20 short:h-10 short:text-lg"
            >
              <span className="inline-flex items-center gap-2">
                <HugeiconsIcon icon={rematch.mine ? Tick02Icon : RepeatIcon} strokeWidth={1.8} className="size-5" />
                Rematch
                {asked && (
                  <span className="tabular-nums opacity-60">
                    {rematch.agreed.length}/{here}
                  </span>
                )}
              </span>
            </PrimaryButton>
            <PrimaryButton onClick={onContinue} disabled={!onContinue} className="h-12 max-w-none px-4 text-xl short:h-10 short:text-lg">
              <span className="inline-flex items-center gap-2">
                Continue
                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={1.8} className="size-5" />
              </span>
            </PrimaryButton>
          </div>
          {line && (
            <p role="status" className="ph-mask text-center font-sans text-sm opacity-70">
              {line}
            </p>
          )}
        </div>
      </div>
    </animated.section>
  )
}
