"use client"

import type { PlayerResult } from "@flip-7/engine"
import { useState } from "react"
import { GameOver } from "@pbgo/core/components/game/game-over"
import type { BoardProps } from "@pbgo/core/lib/binding"
import { missing } from "@pbgo/core/lib/missing"
import { cn } from "@pbgo/ui/utils"
import type { Word } from "../../lib/catalog"
import { useWords } from "./catalog-context"

/** The engine's score detail (`results.ts`) keyed to the words of the board. */
const DETAIL_WORDS = {
  rounds: "detailRounds",
  bestRound: "detailBestRound",
  flip7: "detailFlip7",
  busts: "detailBusts",
} as const satisfies Record<string, Word>

const wordOf = (key: string): Word | null => (Object.hasOwn(DETAIL_WORDS, key) ? DETAIL_WORDS[key as keyof typeof DETAIL_WORDS] : null)

/** The chips of a player's result: figures of the game (rounds played, best round…), not points, so no sign. */
function Details({ result, large, centered }: { result: PlayerResult; large: boolean; centered: boolean }) {
  const w = useWords()
  return (
    <div className={cn("flex flex-wrap items-center", centered ? "justify-center" : "justify-start", large ? "gap-2" : "gap-1.5")}>
      {result.detail.map((d) => {
        const word = wordOf(d.key)
        const label = word ? w[word] : missing(d.key)
        return (
          <span
            key={d.key}
            title={`${label}: ${d.points}`}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md border border-current/15 bg-current/10 font-display font-bold tabular-nums",
              large ? "h-8 px-3 text-sm short:h-7 short:px-2.5 short:text-xs" : "h-7 px-2.5 text-xs short:h-6 short:px-2 short:text-[11px]",
            )}
            style={{ opacity: d.points === 0 ? 0.45 : 1 }}
          >
            <span className="font-sans font-medium opacity-60">{label}</span>
            {d.points}
          </span>
        )
      })}
    </div>
  )
}

/** The game over panel. It is only mounted while the game is over, so a new game starts with the panel open again. */
export function Results({ onUpdate }: Pick<BoardProps, "onUpdate">) {
  const [open, setOpen] = useState(true)
  return (
    <GameOver
      onUpdate={onUpdate}
      isOpen={open}
      onToggle={() => setOpen((o) => !o)}
      renderDetail={(result, { large, centered }) => <Details result={result} large={large} centered={centered} />}
    />
  )
}
