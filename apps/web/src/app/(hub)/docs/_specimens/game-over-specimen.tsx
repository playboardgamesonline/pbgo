"use client"

import { useState } from "react"
import { GameOverCard, type PodiumPlace } from "@pbgo/core/components/game/game-over-card"
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

const RANKS: Record<string, RankChange | null> = {
  none: null,
  gain: { recorded: true, ranked: true, points: 18 },
  loss: { recorded: true, ranked: true, points: -11 },
}

const VOTES = ["none", "asked", "agreed", "left"] as const
type Vote = (typeof VOTES)[number]

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
 * The end screen of every game, two games side by side, each in its own look over its own table: the podium for any number of players, a tie, teams and a table that plays together, the rank points of a ranked game and the state of the rematch, each
 * picked by hand. The card is the component of a table (`GameOverCard`), fed here with samples and dressed by what each game gives it (`UI_THEME.gameOver`, `UI_THEME.seat`).
 */
export function GameOverSpecimen({ looks }: { looks: readonly GameLook[] }) {
  const [ending, setEnding] = useState<Ending>("individual")
  const [count, setCount] = useState("4")
  const [you, setYou] = useState<Standing>("first")
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
          label="Rank points"
          value={rank}
          onChange={setRank}
          options={[
            ["none", "None"],
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
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {looks.map((look) => (
          <div key={look.slug} className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              {look.name} · {look.ui?.motion ?? "calm"} motion
            </p>
            <GameScope look={look} className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
              <div className="flex min-h-[34rem] items-center justify-center p-6" style={{ background: TABLE_BACKDROP }}>
                <GameOverCard
                  key={`${look.slug}-${ending}-${count}-${you}`}
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
                  rematch={rematchFor(vote, Number(count))}
                  onRematch={() => {}}
                  onContinue={() => {}}
                  onShare={() => {}}
                  motion={resolveMotion(prefersReduced, look.ui?.motion)}
                />
              </div>
            </GameScope>
          </div>
        ))}
      </div>
    </div>
  )
}
