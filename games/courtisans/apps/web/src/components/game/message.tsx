"use client"

import type { VisibleCard, Target, VisibleEvent } from "@courtisans/engine"
import { Fragment } from "react"
import { cn } from "@pgo/ui/utils"
import { useCourtisans } from "./context"
import { RolePictogram } from "./pictograms"
import { PlayerName } from "@pgo/core/components/game/hud"

export function CardBadge({ card, className }: { card: VisibleCard; className?: string }) {
  const { catalog } = useCourtisans()
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
      <span className="relative">{card.role ? catalog.roles[card.role].name : "Courtisan"}</span>
    </span>
  )
}

function Zone({ target, authorId }: { target: Target; authorId: string }) {
  const meId = useCourtisans().view.me?.id
  if (target.zone === "table") return <span>à la table de la Reine</span>
  if (target.playerId === authorId) return <span>{authorId === meId ? "chez vous" : "chez lui"}</span>
  if (target.playerId === meId) return <span>chez vous</span>
  return (
    <span>
      chez <PlayerName id={target.playerId} />
    </span>
  )
}

const YOU: Record<string, string> = { played: "jouez", élimine: "éliminez", deck: "piochez" }

function Subject({ id, verb }: { id: string; verb: string }) {
  const meId = useCourtisans().view.me?.id
  if (id === meId)
    return (
      <span>
        Vous {YOU[verb.split(" ")[0]!] ?? verb.split(" ")[0]}
        {verb.slice(verb.split(" ")[0]!.length)}
      </span>
    )
  return (
    <>
      <PlayerName id={id} /> <span>{verb}</span>
    </>
  )
}

const LINE = "inline-flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1"

export function Message({ event, className }: { event: VisibleEvent; className?: string }) {
  switch (event.type) {
    case "cardPlayed":
      return (
        <span className={cn(LINE, className)}>
          <Subject id={event.playerId} verb="joue" /> <CardBadge card={event.card} />{" "}
          <Zone target={event.target} authorId={event.playerId} />
        </span>
      )
    case "cardEliminated":
      return (
        <span className={cn(LINE, className)}>
          <Subject id={event.playerId} verb="élimine" /> <CardBadge card={event.card} />{" "}
          <Zone target={event.target} authorId={event.playerId} />
        </span>
      )
    case "draw":
      return (
        <span className={cn(LINE, className)}>
          <Subject id={event.playerId} verb={`pioche ${event.count} carte${event.count > 1 ? "s" : ""}`} />
        </span>
      )
    case "gameOver":
      return <span className={className}>La pioche est vide : fin de la partie !</span>
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
