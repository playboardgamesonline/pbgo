"use client"

import type { ReactNode } from "react"
import { useGame } from "@pbgo/core/components/game/context"
import { PlayerName } from "@pbgo/core/components/game/hud"
import { PlayerSeatLabel } from "@pbgo/core/components/game/player-seat"
import { Button } from "@pbgo/ui/game/button"
import type { TableView } from "../../lib/view"
import { useWords } from "./catalog-context"
import { CardBack, CardChip, CardSlot, FaceCard } from "./card"
import { Sentence } from "./sentence"

type Send = (action: { type: string } & Record<string, unknown>) => void

function Pile({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 short:gap-2">
      <div className="relative">
        {children}
        <span className="absolute -right-2 -bottom-2 min-w-6 rounded-full bg-surface-dark px-1.5 text-center font-display text-xs tabular-nums ring-1 ring-foreground/20">{count}</span>
      </div>
      <span className="text-xs tracking-wider text-foreground/70 uppercase">{label}</span>
    </div>
  )
}

/** The draw pile and the discard: only their size is public, the discard shows its top face. */
function Piles() {
  const w = useWords()
  const { view } = useGame<TableView>()
  const top = view.discard[0]
  return (
    <div className="flex items-center gap-6 short:gap-4">
      <Pile label={w.deck} count={view.deck.size}>
        <CardBack size="md" />
      </Pile>
      <Pile label={w.discard} count={view.discard.length}>
        {top ? <FaceCard type={top.type} size="md" /> : <CardSlot size="md" />}
      </Pile>
    </div>
  )
}

const MESSAGE = "min-w-0 text-sm text-foreground/90 short:text-xs"

/** The bottom of the table: the piles on the left, and what the player can do now (or who the game waits for) next to them. */
export function ActionBar({ sending, onSend }: { sending: boolean; onSend: Send }) {
  const w = useWords()
  const { view } = useGame<TableView>()
  const { step } = view
  const meId = view.me?.id ?? null
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-8 gap-y-3 px-4 pt-2 pb-4 short:gap-y-1 short:pb-2 md:pr-[27rem]">
      <Piles />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        {step.kind === "turn" && step.player === meId && (
          <>
            <Button size="lg" disabled={sending} onClick={() => onSend({ type: "hit" })}>
              {w.hit}
            </Button>
            <Button size="lg" variant="secondary" disabled={sending || !step.canStay} onClick={() => onSend({ type: "stay" })}>
              {w.stay}
            </Button>
          </>
        )}
        {step.kind === "target" && step.player === meId && (
          <>
            <FaceCard type={step.card.type} size="md" />
            <p className={MESSAGE}>
              <Sentence text={w.targetPrompt} slots={{ card: <CardChip type={step.card.type} /> }} />
            </p>
            <div className="flex flex-wrap gap-2">
              {step.targets.map((id) => (
                <Button key={id} variant="secondary" disabled={sending} onClick={() => onSend({ type: "target", target: id })} className="ph-no-capture">
                  <PlayerSeatLabel playerId={id} size="sm" name="ink" />
                </Button>
              ))}
            </div>
          </>
        )}
        {step.kind === "target" && step.player !== meId && (
          <>
            <FaceCard type={step.card.type} size="md" />
            <p className={MESSAGE}>
              <Sentence text={w.targetOther} slots={{ name: <PlayerName id={step.player} />, card: <CardChip type={step.card.type} /> }} />
            </p>
          </>
        )}
        {step.kind === "between" && step.dealer === meId && (
          <>
            <p className={MESSAGE}>{w.dealMine}</p>
            <Button size="lg" disabled={sending} onClick={() => onSend({ type: "deal" })}>
              {w.deal}
            </Button>
          </>
        )}
        {step.kind === "between" && step.dealer !== meId && (
          <p className={MESSAGE}>
            <Sentence text={w.dealOther} slots={{ name: <PlayerName id={step.dealer} /> }} />
          </p>
        )}
      </div>
    </div>
  )
}
