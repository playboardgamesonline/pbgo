"use client"

import { useState } from "react"
import { GameOverCard, type GameOverTab, type PodiumPlace } from "@pbgo/core/components/game/game-over-card"
import type { HistoryTurn } from "@pbgo/core/components/game/ticker"
import { placesOf, summaryOf, type GameOverEntry } from "@pbgo/core/lib/game-over"
import type { PublicPlayer } from "@pbgo/core/lib/game-types"
import { resolveMotion } from "@pbgo/core/lib/motion-preference"
import type { RankChange } from "@pbgo/core/lib/rank-change"
import { rematchOf } from "@pbgo/core/lib/rematch"
import { gameOverTheme, seatTheme } from "@pbgo/core/lib/ui-theme"
import { usePrefersReducedMotion } from "@pbgo/core/lib/use-motion"
import type { PlayerResult, Results } from "@pbgo/engine-kit"
import { Tabs, TabsList, TabsTrigger } from "@pbgo/ui/platform/tabs"
import { cn } from "@pbgo/ui/utils"
import { Crown, GameScope, TABLE_BACKDROP, type GameLook } from "./game-scope"

const NAMES = ["Ana", "Ben", "Chloé", "Dario", "Eva", "Félix"]
/** The names a game gives its teams. */
const TEAMS = ["Red team", "Blue team"]
/** The visitor is the first seat. */
const ME = "p0"

const ENDINGS = [
  ["individual", "Each for themselves"],
  ["tie", "Tie"],
  ["teams", "Teams"],
  ["won-together", "Won together"],
  ["lost-together", "Lost together"],
] as const
type Ending = (typeof ENDINGS)[number][0]
type Standing = "first" | "last"

const lines = (cards: number, bonus: number): PlayerResult["detail"] => [
  { key: "cards", label: "Cards", points: cards },
  { key: "bonus", label: "Bonus", points: bonus },
]

/**
 * The results of a table of `count` players ending as `ending`, the visitor first or last. Players who share a rank share a place of the podium, which is how a tie and a team are told: the members of a team have the rank of their team, and a table
 * that plays together has everybody first.
 */
function resultsOf(ending: Ending, count: number, you: Standing): Results {
  const ids = Array.from({ length: count }, (_, i) => `p${i}`)
  if (ending === "won-together" || ending === "lost-together") {
    const won = ending === "won-together"
    return { winners: won ? ids : [], coop: won ? "won" : "lost", players: ids.map((playerId) => ({ playerId, total: 12, rank: 1, detail: [] })) }
  }
  // Who finishes where: the visitor first or last, the others in seat order
  const order = you === "first" ? ids : [...ids.slice(1), ids[0]!]
  if (ending === "teams") {
    const winning = new Set(order.slice(0, Math.ceil(count / 2)))
    return { winners: [...winning], players: ids.map((playerId) => ({ playerId, total: winning.has(playerId) ? 12 : 9, rank: winning.has(playerId) ? 1 : 2, detail: [] })) }
  }
  const totals = [9, 8, 6, 5, 4, 3]
  const tied = ending === "tie"
  const place = (position: number) => (tied && position <= 1 ? 1 : position + 1)
  return {
    winners: order.filter((_, position) => place(position) === 1),
    players: ids.map((playerId) => {
      const position = order.indexOf(playerId)
      return { playerId, total: tied && position === 1 ? totals[0]! : totals[position]!, rank: place(position), detail: lines(totals[position]! - 2, 2) }
    }),
  }
}

const MOVES = ["draws a card", "plays a Noble in their domain", "plays a Guard at the Queen's table", "plays a Spy", "passes the turn"]

/** The history of a game of `count` players that lasted three rounds, the way a board gives it to its ticker: the newest turn first, and some turns of two moves. */
function historyFor(count: number): HistoryTurn[] {
  const turns: HistoryTurn[] = []
  for (let index = 0; index < count * 3; index++) {
    const moves = index % 3 === 1 ? 2 : 1
    turns.push({ key: index, playerId: `p${index % count}`, entries: Array.from({ length: moves }, (_, move) => ({ key: `${index}:${move}`, node: MOVES[(index + move) % MOVES.length]! })) })
  }
  return turns.reverse()
}

const TABS: readonly (readonly [GameOverTab, string])[] = [
  ["scores", "Scores"],
  ["stats", "Stats"],
  ["history", "History"],
]

const RANKS: Record<string, RankChange | null> = {
  none: null,
  normal: { recorded: true, ranked: false, points: null, xp: 24 },
  gain: { recorded: true, ranked: true, points: 18, xp: 31 },
  loss: { recorded: true, ranked: true, points: -11, xp: 19 },
}

type Vote = "none" | "asked" | "agreed" | "left"

/** Where the vote for another game stands at a table of `count` players. */
function rematchFor(vote: Vote, count: number) {
  const players: PublicPlayer[] = Array.from({ length: count }, (_, i) => ({ id: `p${i}`, nickname: NAMES[i]!, ...(vote === "left" && i === count - 1 ? { left: true } : {}) }))
  const voted = vote === "asked" ? ["p1", "p2"] : vote === "agreed" ? ["p0", "p1"] : vote === "left" ? ["p1"] : []
  return rematchOf(players, voted, ME, 2)
}

function Choice<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (value: T) => void; options: readonly (readonly [T, string])[] }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-sm text-muted-foreground">{label}</span>
      <Tabs value={value} onValueChange={(next) => onChange(next as T)}>
        <TabsList>
          {options.map(([key, name]) => (
            <TabsTrigger key={key} value={key}>
              {name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}

/**
 * The end screen of every game, two games side by side, each in its own look over its own table: the podium for any number of players, a tie, teams and a table that plays together, the tab that is open under it (the scores, the statistics, the history, which a
 * game that gives no history does not have), the rank points and the experience of a member and the state of the rematch, each picked by hand. The card is the component of a table (`GameOverCard`), fed here with samples and dressed by what each game
 * gives it (`UI_THEME.gameOver`, `UI_THEME.seat`).
 */
export function GameOverSpecimen({ looks }: { looks: readonly GameLook[] }) {
  const [ending, setEnding] = useState<Ending>("individual")
  const [count, setCount] = useState("4")
  const [you, setYou] = useState<Standing>("first")
  const [tab, setTab] = useState<GameOverTab>("scores")
  const [withHistory, setWithHistory] = useState("yes")
  const [screen, setScreen] = useState("wide")
  const [rank, setRank] = useState("none")
  const [vote, setVote] = useState<Vote>("none")
  const prefersReduced = usePrefersReducedMotion()
  const together = ending === "won-together" || ending === "lost-together"
  const results = resultsOf(ending, Number(count), you)
  const placesFor = (look: GameLook): PodiumPlace[] => {
    const entryOf = (result: PlayerResult): GameOverEntry => {
      const seat = Number(result.playerId.slice(1))
      return { result, nickname: NAMES[seat]!, color: look.playerColors[seat % look.playerColors.length]! }
    }
    return placesOf(results).map((place, index) => ({ rank: place.rank, entries: place.results.map(entryOf), ...(ending === "teams" ? { label: TEAMS[index] } : {}) }))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Choice label="Ending" value={ending} onChange={setEnding} options={ENDINGS} />
        <Choice
          label="Players"
          value={count}
          onChange={setCount}
          options={[
            ["2", "2"],
            ["3", "3"],
            ["4", "4"],
            ["5", "5"],
            ["6", "6"],
          ]}
        />
        {!together && (
          <Choice
            label="You are"
            value={you}
            onChange={setYou}
            options={[
              ["first", "First"],
              ["last", "Last"],
            ]}
          />
        )}
        <Choice
          label="History"
          value={withHistory}
          onChange={setWithHistory}
          options={[
            ["yes", "The game gives it"],
            ["no", "None"],
          ]}
        />
        {withHistory === "yes" && <Choice label="Open tab" value={tab} onChange={setTab} options={TABS} />}
        <Choice
          label="Screen"
          value={screen}
          onChange={setScreen}
          options={[
            ["wide", "Wide"],
            ["narrow", "Narrow"],
          ]}
        />
        <Choice
          label="Rank, XP"
          value={rank}
          onChange={setRank}
          options={[
            ["none", "None"],
            ["normal", "XP only"],
            ["gain", "+18"],
            ["loss", "−11"],
          ]}
        />
        <Choice
          label="Rematch"
          value={vote}
          onChange={setVote}
          options={[
            ["none", "Nobody asked"],
            ["asked", "Asked"],
            ["agreed", "Agreed"],
            ["left", "One left"],
          ]}
        />
      </div>
      <div className={cn("grid grid-cols-1 gap-6", screen === "narrow" && "xl:grid-cols-2")}>
        {looks.map((look) => (
          <div key={look.slug} className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              {look.name} · {look.ui?.motion ?? "calm"} motion
            </p>
            <GameScope look={look} className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
              <div className={cn("flex min-h-[46rem] items-center justify-center p-6", screen === "narrow" && "px-3")} style={{ background: TABLE_BACKDROP }}>
                <div className={cn("flex w-full justify-center", screen === "narrow" && "max-w-sm")}>
                  <GameOverCard
                    key={`${look.slug}-${ending}-${count}-${you}-${tab}-${withHistory}`}
                    theme={gameOverTheme(look.ui?.gameOver)}
                    seat={seatTheme(look.ui?.seat)}
                    pattern={null}
                    crown={(size) => <Crown className={cn("fill-current text-current", size)} />}
                    summary={summaryOf(results, ME)}
                    places={placesFor(look)}
                    winners={results.winners}
                    together={results.coop}
                    meId={ME}
                    rank={RANKS[rank]}
                    history={withHistory === "yes" ? historyFor(Number(count)) : undefined}
                    defaultTab={tab}
                    rematch={rematchFor(vote, Number(count))}
                    onRematch={() => {}}
                    onContinue={() => {}}
                    onShare={() => {}}
                    motion={resolveMotion(prefersReduced, look.ui?.motion)}
                  />
                </div>
              </div>
            </GameScope>
          </div>
        ))}
      </div>
    </div>
  )
}
