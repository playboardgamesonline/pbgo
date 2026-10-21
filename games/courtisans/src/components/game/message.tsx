"use client"

import type { VisibleCard, Target, VisibleEvent } from "@courtisans/engine"
import { Fragment } from "react"
import { cn } from "@pbgo/ui/utils"
import type { Vocabulary } from "../../lib/catalog"
import { useCourtisans } from "./context"
import { RolePictogram } from "./pictograms"
import { PlayerName } from "@pbgo/core/components/game/hud"

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
      <span className="relative">{card.role ? catalog.roles[card.role].name : catalog.words.courtier}</span>
    </span>
  )
}

function Zone({ target, authorId }: { target: Target; authorId: string }) {
  const { catalog, view } = useCourtisans()
  const { words } = catalog
  const meId = view.me?.id
  if (target.zone === "table") return <span>{words.zoneTable}</span>
  if (target.playerId === authorId) return <span>{authorId === meId ? words.zoneYours : words.zoneTheirs}</span>
  if (target.playerId === meId) return <span>{words.zoneYours}</span>
  // `zoneOther` holds `{name}` where the player's name goes
  const [before, after = ""] = words.zoneOther.split("{name}")
  return (
    <span>
      {before}
      <PlayerName id={target.playerId} />
      {after}
    </span>
  )
}

type Action = "play" | "eliminate" | { draw: number }

/** The sentence of an action in the wordings of Sanity: the viewer's own (`youPlay`…) or another player's (`theyPlay`…, which follows the player's name). */
function sentence(words: Vocabulary, you: boolean, action: Action) {
  if (action === "play") return you ? words.youPlay : words.theyPlay
  if (action === "eliminate") return you ? words.youEliminate : words.theyEliminate
  const many = action.draw > 1
  const text = you ? (many ? words.youDrawMany : words.youDrawOne) : many ? words.theyDrawMany : words.theyDrawOne
  return text.replace("{count}", String(action.draw))
}

function Subject({ id, action }: { id: string; action: Action }) {
  const { catalog, view } = useCourtisans()
  const you = id === view.me?.id
  const text = sentence(catalog.words, you, action)
  if (you) return <span>{text}</span>
  return (
    <>
      <PlayerName id={id} /> <span>{text}</span>
    </>
  )
}

const LINE = "inline-flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1"

export function Message({ event, className }: { event: VisibleEvent; className?: string }) {
  const { catalog } = useCourtisans()
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
      return <span className={className}>{catalog.words.gameOverLog}</span>
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
