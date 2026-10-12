"use client"

import type { VisibleCard, Target, VisibleEvent } from "@courtisans/engine"
import { Fragment } from "react"
import { cn } from "@pbgo/ui/utils"
import { useCourtisans } from "./context"
import { RolePictogram } from "./pictograms"
import { PlayerName } from "@pbgo/core/components/game/hud"
import { useDict } from "../use-dict"

export function CardBadge({ card, className }: { card: VisibleCard; className?: string }) {
  const { catalog } = useCourtisans()
  const d = useDict()
  const family = card.family ? catalog.families[card.family] : null
  return (
    <span
      className={cn(
        "relative inline-flex items-center gap-1.5 overflow-hidden rounded-md border border-white/30 py-0.5 pr-7 pl-1.5 align-middle font-semibold whitespace-nowrap text-white shadow-md [text-shadow:0_1px_3px_rgb(0_0_0/70%)]",
        className,
      )}
      style={{ backgroundColor: family?.color ?? "var(--disgrace)" }}
    >
      {family?.pictogramUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={family.pictogramUrl} alt="" aria-hidden className="pointer-events-none absolute -right-1.5 -bottom-2.5 size-10 opacity-35" />
      )}
      {card.role && <RolePictogram role={card.role} className="relative size-[1.15em] bg-transparent p-0" />}
      <span className="relative">{card.role ? catalog.roles[card.role].name : d.courtier}</span>
    </span>
  )
}

function Zone({ target, authorId }: { target: Target; authorId: string }) {
  const meId = useCourtisans().view.me?.id
  const { zone } = useDict()
  if (target.zone === "table") return <span>{zone.table}</span>
  if (target.playerId === authorId) return <span>{authorId === meId ? zone.mine : zone.own}</span>
  if (target.playerId === meId) return <span>{zone.mine}</span>
  return (
    <span>
      {zone.other[0]}
      <PlayerName id={target.playerId} />
      {zone.other[1]}
    </span>
  )
}

type Action = "play" | "eliminate" | { draw: number }

function Subject({ id, action }: { id: string; action: Action }) {
  const meId = useCourtisans().view.me?.id
  const { you, they } = useDict()
  const text = (v: typeof you) => (typeof action === "string" ? v[action] : v.draw(action.draw))
  if (id === meId) return <span>{text(you)}</span>
  return (
    <>
      <PlayerName id={id} /> <span>{text(they)}</span>
    </>
  )
}

const LINE = "inline-flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1"

export function Message({ event, className }: { event: VisibleEvent; className?: string }) {
  const d = useDict()
  switch (event.type) {
    case "cardPlayed":
      return (
        <span className={cn(LINE, className)}>
          <Subject id={event.playerId} action="play" /> <CardBadge card={event.card} />{" "}
          <Zone target={event.target} authorId={event.playerId} />
        </span>
      )
    case "cardEliminated":
      return (
        <span className={cn(LINE, className)}>
          <Subject id={event.playerId} action="eliminate" /> <CardBadge card={event.card} />{" "}
          <Zone target={event.target} authorId={event.playerId} />
        </span>
      )
    case "draw":
      return (
        <span className={cn(LINE, className)}>
          <Subject id={event.playerId} action={{ draw: event.count }} />
        </span>
      )
    case "gameOver":
      return <span className={className}>{d.gameOverLog}</span>
  }
}

export function Messages({ events }: { events: VisibleEvent[] }) {
  return (
    <>
      {events.map((e, i) => (
        <Fragment key={i}>
          <Message event={e} />
        </Fragment>
      ))}
    </>
  )
}
