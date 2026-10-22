"use client"

import { CARDS, type CardKey, type CardKind } from "@flip-7/engine"
import { missing } from "@pbgo/core/lib/missing"
import { cn } from "@pbgo/ui/utils"
import { useCatalog } from "./catalog-context"

/** Widths of a card: the pictures are 326 × 512, so the height follows. */
const SIZES = {
  sm: "w-8 short:w-6",
  md: "w-12 short:w-8",
  lg: "w-[4.5rem] short:w-10",
} as const

export type CardSize = keyof typeof SIZES

const FRAME = "block aspect-[326/512] shrink-0 rounded-[0.3em]"

/** The figure a number or a modifier shows (`number-7` → 7, `plus-4` → +4, `times-2` → ×2): notation, not wording. */
export function figureOf(type: string): string | null {
  const match = /^(number|plus|times)-(\d+)$/.exec(type)
  const kind = match?.[1]
  const amount = match?.[2]
  if (!kind || !amount) return null
  return kind === "plus" ? `+${amount}` : kind === "times" ? `×${amount}` : amount
}

/** `number`, `modifier` or `action`; a face the engine does not know is read as an action card. */
export function kindOf(type: string): CardKind {
  return Object.hasOwn(CARDS, type) ? CARDS[type as CardKey].kind : "action"
}

/** What names a card in a sentence or an `alt`: its figure, else its name in Sanity, else the marker of the missing name. */
export function useFaceLabel() {
  const { faces } = useCatalog()
  return (type: string) => figureOf(type) ?? faces[type]?.name ?? missing(type)
}

/** A face of the game: the picture of Sanity, or a typographic stand-in when the project does not have it. */
export function FaceCard({ type, size = "md", className }: { type: string; size?: CardSize; className?: string }) {
  const { faces } = useCatalog()
  const label = useFaceLabel()(type)
  const imageUrl = faces[type]?.imageUrl
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt={label} draggable={false} className={cn(FRAME, SIZES[size], "bg-secondary object-cover shadow-md select-none", className)} />
  }
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        FRAME,
        SIZES[size],
        "flex items-center justify-center overflow-hidden bg-secondary p-0.5 text-center font-display leading-none break-all text-secondary-foreground shadow-md",
        figureOf(type) ? "text-lg font-black" : "text-[0.5rem]",
        className,
      )}
    >
      {label}
    </span>
  )
}

/** The back of a card: the picture of Sanity, or a drawn stand-in (stripes on the table's dark) while the project has none. */
export function CardBack({ size = "md", className }: { size?: CardSize; className?: string }) {
  const { cardBackUrl } = useCatalog()
  if (cardBackUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={cardBackUrl} alt="" aria-hidden draggable={false} className={cn(FRAME, SIZES[size], "object-cover shadow-md select-none", className)} />
  }
  return (
    <span
      aria-hidden
      className={cn(
        FRAME,
        SIZES[size],
        "border-2 border-secondary bg-surface-dark bg-[image:repeating-linear-gradient(45deg,transparent_0_0.3rem,var(--accent-game)_0.3rem_0.38rem)] shadow-md",
        className,
      )}
    />
  )
}

/** An empty place where a card would lie (an empty line, an empty discard). */
export function CardSlot({ size = "md", className }: { size?: CardSize; className?: string }) {
  return <span aria-hidden className={cn(FRAME, SIZES[size], "border border-dashed border-foreground/25", className)} />
}

/** A card inside a sentence: its figure or its name on a small paper label. */
export function CardChip({ type, className }: { type: string; className?: string }) {
  const label = useFaceLabel()(type)
  return (
    <span className={cn("inline-flex items-center rounded-[0.3em] bg-foreground/90 px-1.5 font-display font-bold text-surface-dark tabular-nums", className)}>{label}</span>
  )
}
