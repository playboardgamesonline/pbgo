"use client"

import { Flag02Icon, UserAdd01Icon, UserIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { profilePath, tagText } from "@pbgo/accounts"
import { initials } from "@pbgo/ui/friends"
import { Avatar, AvatarFallback, AvatarImage } from "@pbgo/ui/platform/avatar"
import { Button } from "@pbgo/ui/platform/button"
import { PresenceDot } from "@pbgo/ui/platform/friends-panel"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@pbgo/ui/platform/hover-card"
import { cn } from "@pbgo/ui/utils"
import type { PublicPlayer } from "../../lib/game-types"
import { shortName } from "../../lib/short-name"
import { useText } from "../skin-provider"
import { useGame } from "./context"

/**
 * The players of the table in the platform's look, under the dock at the top right of the screen and in view for as long as the game runs: who sits at the table, whom the game waits for, who is away and what each of them has so far
 * (`view.standings`, in seat order). The picture wears the colour of the seat, so that a row finds its plate on the table. The pointer on a row opens the card of the player, with what a visitor may do about them. For a member (a seat with a tag) it says the tag and links to their profile in a new tab, so that nobody leaves the game (PLT-39).
 */
export function TablePlayers({ className }: { className?: string }) {
  const t = useText()
  const { game, view, color } = useGame()
  const scores = new Map((view.standings ?? []).map((standing) => [standing.playerId, standing.score]))
  const over = game.status === "over"
  return (
    <ul aria-label={t("players")} className={cn("platform pointer-events-auto flex w-60 flex-col gap-0.5 rounded-3xl border glass p-1.5 font-sans text-foreground shadow-surface", className)}>
      {game.players.map((player) => (
        <PlayerRow
          key={player.id}
          player={player}
          seat={color(player.id)}
          score={scores.get(player.id)}
          waiting={!over && game.waitingFor.includes(player.id)}
          away={!game.present.includes(player.id)}
          me={player.id === game.meId}
          host={player.id === game.hostId}
        />
      ))}
    </ul>
  )
}

function PlayerRow({ player, seat, score, waiting, away, me, host }: { player: PublicPlayer; seat: string; score: number | undefined; waiting: boolean; away: boolean; me: boolean; host: boolean }) {
  const t = useText()
  // A member's seat has a tag; a guest's has none, and no profile
  const profile = player.tag ? profilePath({ nickname: player.nickname, tag: player.tag }, "seat") : null
  const picture = (size?: "xl") => (
    <Avatar size={size} style={size ? undefined : { boxShadow: `0 0 0 2px ${seat}` }}>
      {player.avatarUrl && <AvatarImage src={player.avatarUrl} alt="" referrerPolicy="no-referrer" />}
      <AvatarFallback className="ph-mask">{initials(player.nickname)}</AvatarFallback>
      <PresenceDot status={away ? "inactive" : "online"} />
    </Avatar>
  )
  return (
    <li>
      <HoverCard>
        <HoverCardTrigger asChild>
          <div className={cn("flex items-center gap-3 rounded-2xl py-1.5 pr-3 pl-2 transition-colors", waiting && "bg-muted", away && "opacity-60")}>
            {picture()}
            <span className="ph-mask min-w-0 flex-1 truncate text-base leading-tight" title={player.nickname}>
              {shortName(player.nickname)}
              {me && <span className="ml-1.5 text-muted-foreground">{t("you")}</span>}
            </span>
            {score !== undefined && <span className="text-lg leading-none font-strong tabular-nums">{score}</span>}
          </div>
        </HoverCardTrigger>
        <HoverCardContent side="left" align="start" className="w-64">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              {picture("xl")}
              <div className="flex min-w-0 flex-col gap-1">
                <p className="ph-mask truncate text-lg leading-tight font-strong text-foreground">
                  {player.nickname}
                  {player.tag ? <span className="text-muted-foreground">#{tagText(player.tag)}</span> : null}
                </p>
                <p className="truncate text-sm text-muted-foreground">{me ? t("you") : host ? t("host") : null}</p>
              </div>
            </div>
            {(profile || !me) && (
              <div className="flex flex-col gap-2 border-t pt-4">
                {profile && (
                  <Button asChild variant="secondary" size="lg" className="w-full justify-start">
                    <a href={profile} target="_blank" rel="noopener noreferrer" className="ph-no-capture">
                      <HugeiconsIcon icon={UserIcon} strokeWidth={2} aria-hidden="true" />
                      {t("viewProfile")}
                    </a>
                  </Button>
                )}
                {!me && (
                  <>
                    <Button type="button" variant="secondary" size="lg" className="w-full justify-start" disabled>
                      <HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} aria-hidden="true" />
                      {t("addFriend")}
                    </Button>
                    <Button type="button" variant="secondary" size="lg" className="w-full justify-start" disabled>
                      <HugeiconsIcon icon={Flag02Icon} strokeWidth={2} aria-hidden="true" />
                      {t("reportPlayer")}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </HoverCardContent>
      </HoverCard>
    </li>
  )
}
