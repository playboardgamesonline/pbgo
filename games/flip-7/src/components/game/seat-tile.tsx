"use client"

import type { Face, PublicSeat } from "@flip-7/engine"
import { Crown } from "lucide-react"
import { motion, type MotionProps } from "motion/react"
import { useEffect, useRef } from "react"
import { PlayerSeatLabel } from "@pbgo/core/components/game/player-seat"
import { useText } from "@pbgo/core/components/skin-provider"
import { useMotion } from "@pbgo/core/lib/use-motion"
import { cn } from "@pbgo/ui/utils"
import { useWords } from "./catalog-context"
import { type CardSize, CardSlot, FaceCard, kindOf } from "./card"

const ORDER = { number: 0, modifier: 1, action: 2 } as const

const BADGE = {
  stayed: "bg-foreground/15",
  frozen: "bg-sky-300/30",
  busted: "bg-destructive/80",
} as const

/** How a card lands on a line: a fade for reduced motion, a short slide when calm, a spring when lively. */
const entryOf = (mode: ReturnType<typeof useMotion>): MotionProps =>
  mode === "reduced"
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.15 } }
    : mode === "calm"
      ? { initial: { opacity: 0, y: -8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.2, ease: "easeOut" } }
      : { initial: { opacity: 0, y: -18, scale: 0.85 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { type: "spring", stiffness: 420, damping: 28 } }

/** The numbers first, then the modifiers, then the action cards, each group in the order the cards came. */
const arranged = (cards: Face[]) => [...cards].sort((a, b) => ORDER[kindOf(a.type)] - ORDER[kindOf(b.type)])

/** The number card that made the line bust: the first one whose value was already on the line. */
function duplicateOf(cards: Face[]): number | null {
  const seen = new Set<string>()
  for (const card of cards) {
    if (kindOf(card.type) !== "number") continue
    if (seen.has(card.type)) return card.id
    seen.add(card.type)
  }
  return null
}

type Props = { seat: PublicSeat; mine: boolean; waiting: boolean; dealer: boolean; compact?: boolean }

/** One player's place at the table: who they are, their line of cards, what it is worth now and what they banked. */
export function SeatTile({ seat, mine, waiting, dealer, compact = false }: Props) {
  const w = useWords()
  const t = useText()
  const mode = useMotion()
  const ref = useRef<HTMLElement>(null)
  const size: CardSize = mine ? "lg" : compact ? "sm" : "md"
  const duplicate = seat.status === "busted" ? duplicateOf(seat.cards) : null
  const badge = seat.status === "active" ? null : seat.status
  // The tiles of the others sit in an area that scrolls when the table is full: the one the game waits for is brought into view.
  useEffect(() => {
    if (waiting && !mine) ref.current?.scrollIntoView({ block: "nearest", behavior: mode === "reduced" ? "auto" : "smooth" })
  }, [waiting, mine, mode])
  return (
    <section
      ref={ref}
      className={cn(
        "relative flex min-w-0 flex-col rounded-2xl ring-1 ring-foreground/10 transition-shadow duration-200 ease-out motion-reduce:transition-none",
        mine ? "gap-2 bg-surface-dark/90 p-3 short:gap-1 short:p-2" : "gap-1.5 bg-surface-dark/70 p-2.5 short:gap-1 short:p-2",
        waiting && "ring-2 ring-accent-game",
      )}
    >
      <header className="flex items-center justify-between gap-2">
        <PlayerSeatLabel
          playerId={seat.id}
          size="md"
          corner={waiting ? <Crown className="size-3.5 text-accent-game" aria-hidden /> : undefined}
          className="min-w-0 font-display text-base"
        >
          {mine && <span className="shrink-0 font-sans text-xs font-normal opacity-60">{t("you")}</span>}
        </PlayerSeatLabel>
        <div className="flex shrink-0 items-center gap-1.5 text-[0.65rem] tracking-wider uppercase">
          {dealer && <span className="rounded-full border border-foreground/30 px-2 py-0.5">{w.dealer}</span>}
          {badge && <span className={cn("rounded-full px-2 py-0.5", BADGE[badge])}>{w[badge]}</span>}
        </div>
      </header>

      <div className={cn("flex flex-wrap content-start gap-1.5", seat.status === "busted" && "opacity-70")}>
        {seat.cards.length === 0 ? (
          <CardSlot size={size} />
        ) : (
          arranged(seat.cards).map((card) => (
            <motion.span key={card.id} {...entryOf(mode)} className="flex">
              <FaceCard type={card.type} size={size} className={cn(card.id === duplicate && "ring-2 ring-destructive")} />
            </motion.span>
          ))
        )}
      </div>

      {seat.held.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 opacity-60">
          <span className="text-[0.65rem] tracking-wider uppercase">{w.setAside}</span>
          {seat.held.map((card) => (
            <FaceCard key={card.id} type={card.type} size="sm" />
          ))}
        </div>
      )}

      <dl className="mt-auto flex items-baseline justify-between gap-3 text-xs text-foreground/70">
        <div className="flex items-baseline gap-1.5">
          <dt>{w.scoreNow}</dt>
          <dd className={cn("font-display text-foreground tabular-nums", mine ? "text-xl" : "text-base", seat.status === "busted" && "opacity-60")}>{seat.score}</dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt>{w.scoreTotal}</dt>
          <dd className={cn("font-display text-foreground tabular-nums", mine ? "text-xl" : "text-base")}>{seat.total}</dd>
        </div>
      </dl>
    </section>
  )
}
