"use client"

import { useState } from "react"
import { GameOverPanel } from "@pbgo/core/components/game/game-over-panel"
import { pointsLine, type GameOverEntry } from "@pbgo/core/lib/game-over"
import { resolveMotion } from "@pbgo/core/lib/motion-preference"
import { fill } from "@pbgo/core/lib/skin"
import { gameOverTheme, seatTheme } from "@pbgo/core/lib/ui-theme"
import { usePrefersReducedMotion } from "@pbgo/core/lib/use-motion"
import { Button } from "@pbgo/ui/platform/button"
import { Label } from "@pbgo/ui/platform/label"
import { Switch } from "@pbgo/ui/platform/switch"
import { Tabs, TabsList, TabsTrigger } from "@pbgo/ui/platform/tabs"
import { cn } from "@pbgo/ui/utils"
import { Crown, GameScope, TABLE_BACKDROP, type GameLook } from "./game-scope"
import { Fit } from "./scaled"

const NAMES = ["Ana", "Ben", "Chloé", "Dario"]

/** The score lines of a result: the same two chips for everyone, so only the look differs */
const detail = (cards: number, bonus: number): GameOverEntry["result"]["detail"] => [
  { key: "cards", label: "Cards", points: cards },
  { key: "bonus", label: "Bonus", points: bonus },
]

const SCORES = {
  /** One winner, then the ranking */
  winner: [detail(9, 5), detail(8, 3), detail(9, 0), detail(6, -2)],
  /** Two players share the first place */
  tie: [detail(8, 4), detail(9, 3), detail(9, 0), detail(6, -2)],
} as const

type Case = keyof typeof SCORES

function entries(look: GameLook, which: Case): GameOverEntry[] {
  const totals = SCORES[which].map((lines) => lines.reduce((sum, line) => sum + line.points, 0))
  return SCORES[which].map((lines, i) => ({
    result: { playerId: `p${i}`, total: totals[i], rank: 1 + totals.filter((total) => total > totals[i]).length, detail: [...lines] },
    nickname: NAMES[i],
    color: look.playerColors[i % look.playerColors.length],
  }))
}

/** The polaroid's picture: the table's colours and a crown, drawn here since there is no table to photograph */
function thumbnail({ colors }: GameLook) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><radialGradient id="g" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="${colors.surface}"/><stop offset="1" stop-color="${colors.surfaceDark}"/></radialGradient></defs><rect width="400" height="300" fill="url(#g)"/><path d="M130 200 122 118l50 36 28-58 28 58 50-36-8 82z" fill="${colors.accent}"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/** The end screen of every game, two games side by side. The panel is the component of a table, drawn here at its real width and scaled to the column. */
export function GameOverSpecimen({ looks }: { looks: readonly GameLook[] }) {
  const [which, setWhich] = useState<Case>("winner")
  const [reduce, setReduce] = useState(false)
  const [run, setRun] = useState(0)
  const prefersReduced = usePrefersReducedMotion()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Tabs value={which} onValueChange={(value) => setWhich(value as Case)}>
          <TabsList>
            <TabsTrigger value="winner">One winner</TabsTrigger>
            <TabsTrigger value="tie">Tie</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="outline" size="sm" onClick={() => setRun((n) => n + 1)}>
          Replay
        </Button>
        <div className="flex items-center gap-2">
          <Switch id="game-over-reduce" size="sm" checked={reduce} onCheckedChange={setReduce} />
          <Label htmlFor="game-over-reduce">Reduce motion</Label>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {looks.map((look) => {
          const all = entries(look, which)
          const winners = all.filter((entry) => entry.result.rank === 1)
          return (
            <div key={look.slug} className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                {look.name} · {look.ui?.motion ?? "calm"} motion
              </p>
              <GameScope look={look} className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
                <div style={{ background: TABLE_BACKDROP }}>
                  <div className="bg-black/80 px-12 py-8">
                    <Fit width={512}>
                      <div className={cn("flex flex-col")}>
                        <GameOverPanel
                          key={`${which}-${run}-${reduce}`}
                          theme={gameOverTheme(look.ui?.gameOver)}
                          seat={seatTheme(look.ui?.seat)}
                          motion={resolveMotion(prefersReduced || reduce, look.ui?.motion)}
                          winners={winners}
                          others={all.filter((entry) => entry.result.rank !== 1)}
                          labels={{
                            scoreboard: look.labels.scoreboard,
                            winnerTitle: look.labels.winnerTitle,
                            shareResult: look.labels.shareResult,
                            points: (n) => pointsLine(n, (points) => fill(look.labels.pointsShort, { points })),
                          }}
                          pattern={null}
                          crown={(size) => <Crown className={cn("fill-current text-current", size)} />}
                          footer={[look.name, "12 min", "Oct 19, 2026", "PBGO"].join("  ·  ")}
                          thumbnail={thumbnail(look)}
                          onShare={() => {}}
                          entrance={run > 0}
                        />
                      </div>
                    </Fit>
                  </div>
                </div>
              </GameScope>
            </div>
          )
        })}
      </div>
    </div>
  )
}
