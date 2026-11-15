"use client"

import { Flag02Icon, UserAdd01Icon, UserIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { profilePath, tagText } from "@pbgo/accounts"
import { initials } from "@pbgo/ui/friends"
import { Avatar, AvatarFallback, AvatarImage } from "@pbgo/ui/platform/avatar"
import { Button } from "@pbgo/ui/platform/button"
import { PresenceDot } from "@pbgo/ui/platform/friends-panel"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@pbgo/ui/platform/hover-card"
import type { PublicPlayer } from "../../lib/game-types"
import { useText } from "../skin-provider"

/**
 * The card of a player, which the pointer opens on their row in the list of the players, in the platform's look like the social dock it belongs with: it is the social side of a seat (their profile, a friend request, a report), a surface
 * of its own over the table. For a member (a seat with a tag) it says the tag and links to their profile in a new tab, so that nobody leaves the game (PLT-39). `children` is the row it opens on, drawn by the list in the game's look.
 */
export function PlayerCard({ player, away, me, host, children }: { player: PublicPlayer; away: boolean; me: boolean; host: boolean; children: React.ReactElement }) {
  const t = useText()
  // A member's seat has a tag; a guest's has none, and no profile
  const profile = player.tag ? profilePath({ nickname: player.nickname, tag: player.tag }, "seat") : null
  return (
    <HoverCard>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="left" align="start" className="w-64">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Avatar size="xl">
              {player.avatarUrl && <AvatarImage src={player.avatarUrl} alt="" referrerPolicy="no-referrer" />}
              <AvatarFallback className="ph-mask">{initials(player.nickname)}</AvatarFallback>
              <PresenceDot status={away ? "inactive" : "online"} />
            </Avatar>
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
  )
}
