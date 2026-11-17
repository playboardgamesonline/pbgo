import Link from "next/link"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { initialsOf, profilePath } from "@pbgo/accounts"
import { Avatar, AvatarFallback, AvatarImage } from "@pbgo/ui/platform/avatar"
import { Button } from "@pbgo/ui/platform/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@pbgo/ui/platform/dialog"
import { StatBarItem, StatBarValue } from "@pbgo/ui/platform/stat-bar"
import { cn } from "@pbgo/ui/utils"
import type { ProfileFriend } from "@/lib/profile-friends"

// The Friends zone of the member's own profile, the third of the row of figures: the friends as pictures with their names under them, centred, in one row (six of them, the ones who played the most first, then the number of the others, "+4", with no circle round it, which opens the window), and a "See all" at the top of the zone that opens a window with every friend: their picture and name,
// the games they finished at the right of the name and under it the place they came at on average and the share they won, the way a list of players with their figures is drawn. A friend leads to their profile. A friend who keeps their games private has dashes. A member with no friend has "None yet",
// as a game's card of achievements does. A server component: only the window is the client's, and it brings the list with it.

/** How many friends the zone shows before the window that lists them all, at the most: one row of six, each in a column of its own width, so that the card is as wide as that row whatever the names are. The others are one "+4", which opens the window. */
const SHOWN = 6

/** How many games a friend finished, as the list says it ("12 games"); a dash for a friend who keeps them private. */
const gamesText = (played: number | null): string => (played === null ? "—" : `${played} ${played === 1 ? "game" : "games"}`)

/** The colour a share of wins is written in: red under 40%, green from 60%, the text's own between, and for none. */
const rateTone = (rate: number | null): string | undefined => (rate === null ? undefined : rate < 40 ? "text-destructive" : rate >= 60 ? "text-success" : undefined)

const handleOf = (friend: ProfileFriend) => ({ nickname: friend.nickname, tag: friend.tag })

function FriendPicture({ friend, className }: { friend: ProfileFriend; className?: string }) {
  return (
    <Avatar className={className}>
      {friend.avatarUrl && <AvatarImage src={friend.avatarUrl} alt="" referrerPolicy="no-referrer" />}
      <AvatarFallback className="ph-mask">{initialsOf(friend.nickname)}</AvatarFallback>
    </Avatar>
  )
}

/** One figure of a friend in the list: what it counts, small and quiet, and the figure under it. */
function Figure({ label, value, tone, end = false }: { label: string; value: string; tone?: string; end?: boolean }) {
  return (
    <div className={cn("flex flex-col", end && "items-end text-right")}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("font-heading text-xl tabular-nums", tone)}>{value}</dd>
    </div>
  )
}

export function FriendsZone({ friends, className }: { friends: readonly ProfileFriend[]; className?: string }) {
  if (friends.length === 0) {
    return (
      <StatBarItem label="Friends" className={className}>
        <StatBarValue>None yet</StatBarValue>
      </StatBarItem>
    )
  }
  return (
    <Dialog>
      <StatBarItem
        label={`Friends (${friends.length})`}
        className={className}
        action={
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              See all<span className="sr-only"> friends</span>
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} data-icon="inline-end" aria-hidden="true" />
            </Button>
          </DialogTrigger>
        }
      >
        <ul aria-label="Friends who played the most" className="flex">
          {friends.slice(0, SHOWN).map((friend) => (
            <li key={`${friend.nickname}#${friend.tag}`} className="w-10 shrink-0">
              <Link href={profilePath(handleOf(friend))} className="group/friend flex flex-col items-center gap-1.5 outline-none">
                <FriendPicture friend={friend} className="size-9 group-focus-visible/friend:ring-3 group-focus-visible/friend:ring-ring/30" />
                <span title={friend.nickname} className="ph-mask w-full truncate text-center text-xs group-hover/friend:underline">
                  {friend.nickname}
                </span>
              </Link>
            </li>
          ))}
          {friends.length > SHOWN && (
            <li className="w-10 shrink-0">
              <DialogTrigger asChild>
                <button type="button" aria-label={`${friends.length - SHOWN} more friends`} className="group/more flex w-full flex-col items-center outline-none">
                  <span className="flex size-9 items-center justify-center rounded-full text-sm text-muted-foreground tabular-nums transition-colors duration-fast group-hover/more:text-foreground group-focus-visible/more:ring-3 group-focus-visible/more:ring-ring/30">
                    +{friends.length - SHOWN}
                  </span>
                </button>
              </DialogTrigger>
            </li>
          )}
        </ul>
      </StatBarItem>
      <DialogContent aria-describedby={undefined} className="gap-0 overflow-hidden p-0">
        <DialogHeader className="p-6 pr-16">
          <DialogTitle>Friends</DialogTitle>
        </DialogHeader>
        <ul className="flex max-h-[min(32rem,65svh)] flex-col overflow-y-auto overscroll-contain border-t">
          {friends.map((friend) => (
            <li key={`${friend.nickname}#${friend.tag}`} className="border-b last:border-b-0">
              <Link href={profilePath(handleOf(friend))} className="flex items-start gap-4 px-6 py-4 outline-none transition-colors duration-fast hover:bg-muted/50 focus-visible:bg-muted/50">
                <FriendPicture friend={friend} className="size-11" />
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="ph-mask min-w-0 truncate font-heading text-lg">{friend.nickname}</span>
                    <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{gamesText(friend.gamesPlayed)}</span>
                  </div>
                  <dl className="flex items-end justify-between gap-4">
                    <Figure label="Avg. place" value={friend.averagePlace === null ? "—" : friend.averagePlace.toFixed(1)} />
                    <Figure label="Win rate" value={friend.winRate === null ? "—" : `${friend.winRate}%`} tone={rateTone(friend.winRate)} end />
                  </dl>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
