"use client"

import { cn } from "@pbgo/ui/utils"
import { useText } from "../skin-provider"
import { useGame } from "./context"
import { PlayerCard } from "./player-card"
import { PlayerSeatLabel } from "./player-seat"

/**
 * The players of the table, in the game's look, under the dock at the top right of the screen and in view for as long as the game runs: text laid straight on the table with no card behind it (`table-ink`, like the log of the turns), a row
 * for each player with their seat label (the game's `UI_THEME.seat`: its shape, its ring, the colour of its names) in the size of the text beside it, and what they have so far (`view.standings`, in seat order). Whom the game waits for stays at full strength while the others
 * fade, and a player who is away fades more; when the game waits for nobody, every row is the same. The pointer on a row opens the card of the player (`PlayerCard`, the social side of a seat, in the dock's look).
 */
export function TablePlayers({ className }: { className?: string }) {
  const t = useText()
  const { game, view } = useGame()
  const scores = new Map((view.standings ?? []).map((standing) => [standing.playerId, standing.score]))
  const anyWaiting = game.status !== "over" && game.waitingFor.length > 0
  return (
    <ul aria-label={t("players")} className={cn("table-ink flex w-fit max-w-60 flex-col gap-0.5 font-sans text-foreground", className)}>
      {game.players.map((player) => {
        const away = !game.present.includes(player.id)
        const me = player.id === game.meId
        const score = scores.get(player.id)
        return (
          <li key={player.id}>
            <PlayerCard player={player} away={away} me={me} host={player.id === game.hostId}>
              <div
                className={cn(
                  "pointer-events-auto flex items-center gap-3 py-1.5 transition-opacity hover:opacity-100 motion-reduce:transition-none short:py-1",
                  away ? "opacity-50" : anyWaiting && !game.waitingFor.includes(player.id) && "opacity-70",
                )}
              >
                <PlayerSeatLabel playerId={player.id} size="sm" className="min-w-0 flex-1 text-base leading-tight short:text-sm" nameClassName="brightness-150">
                  {me && <span className="shrink-0 text-foreground/70">{t("you")}</span>}
                </PlayerSeatLabel>
                {score !== undefined && <span className="font-display text-lg leading-none tabular-nums short:text-base">{score}</span>}
              </div>
            </PlayerCard>
          </li>
        )
      })}
    </ul>
  )
}
