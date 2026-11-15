"use client"

import { cn } from "@pbgo/ui/utils"
import { useId } from "react"
import { useText } from "../skin-provider"
import { useGame } from "./context"
import { PlayerCard } from "./player-card"
import { PlayerSeatLabel } from "./player-seat"

/**
 * The players of the table, in the game's look, under the dock at the top right of the screen and in view for as long as the game runs: text laid straight on the table with no card behind it (`table-ink`, like the log of the turns), under a small title in
 * the display font (the quiet line of the log's status), aligned to the right, over a hairline (the log's, turned the other way), a row for each player with their seat label (the game's `UI_THEME.seat`: its shape, its ring, the colour of its names) in the size of the text beside it (the viewer's own row says "Me" in place of their nickname, which leaves the room to the others), and what they have so far (`view.standings`, in seat
 * order). Whom the game waits for stays at full strength while the others fade, and a player who is away fades more; when the game waits for nobody, every row is the same. The pointer on a row opens the card of the player (`PlayerCard`, the social side of a seat,
 * in the dock's look). The air between two rows is the padding of the rows, so that the pointer never crosses a gap between them; and a little air is left at the right of the section.
 */
export function TablePlayers({ className }: { className?: string }) {
  const t = useText()
  const { game, view } = useGame()
  const titleId = useId()
  const scores = new Map((view.standings ?? []).map((standing) => [standing.playerId, standing.score]))
  const anyWaiting = game.status !== "over" && game.waitingFor.length > 0
  return (
    <div className={cn("table-ink flex w-fit max-w-64 flex-col pr-2 font-sans text-foreground", className)}>
      <h2 id={titleId} className="-mr-[0.18em] text-right font-display text-sm leading-tight tracking-[0.18em] text-foreground/70 uppercase short:text-xs">
        {t("players")}
      </h2>
      <div aria-hidden className="mt-2 h-px w-full bg-gradient-to-l from-foreground/40 to-transparent short:mt-1.5" />
      <ul aria-labelledby={titleId} className="flex flex-col">
        {game.players.map((player) => {
          const away = !game.present.includes(player.id)
          const me = player.id === game.meId
          const score = scores.get(player.id)
          return (
            <li key={player.id}>
              <PlayerCard player={player} away={away} me={me} host={player.id === game.hostId}>
                <div
                  className={cn(
                    "pointer-events-auto flex items-center gap-3 py-2.5 transition-opacity hover:opacity-100 motion-reduce:transition-none short:py-2",
                    away ? "opacity-50" : anyWaiting && !game.waitingFor.includes(player.id) && "opacity-70",
                  )}
                >
                  <PlayerSeatLabel playerId={player.id} size="sm" label={me ? t("me") : undefined} className="min-w-0 flex-1 text-base leading-tight short:text-sm" nameClassName="brightness-150" />
                  {score !== undefined && <span className="font-display text-lg leading-none tabular-nums short:text-base">{score}</span>}
                </div>
              </PlayerCard>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
