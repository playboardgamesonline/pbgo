import Link from "next/link"
import { initialsOf, profilePath } from "@pbgo/accounts"
import { Avatar, AvatarFallback, AvatarImage } from "@pbgo/ui/platform/avatar"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@pbgo/ui/platform/dialog"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pbgo/ui/platform/empty"
import type { ProfileFriend } from "@/lib/profile-friends"

// The Friends block of the member's own profile: the friends as pictures with their names under them, a row of them at the most (`VISIBLE`: eight, six on a phone), the ones who played the most first, and a "See all" that opens every friend as a list, each with the games they finished
// (a friend who keeps their games private has a dash). A friend leads to their profile. A member with no friend has an empty state. A server component: only the window is the client's, and it brings the list with it.

/** How many friends the block shows before the window that lists them all. */
const VISIBLE = 8

/** On a phone the row is three pictures wide: only two rows of them. */
const PHONE_VISIBLE = 6

/** How many games a friend finished, as the list says it ("12 games"); a dash for a friend who keeps them private. */
const gamesText = (played: number | null): string => (played === null ? "—" : `${played} ${played === 1 ? "game" : "games"}`)

const handleOf = (friend: ProfileFriend) => ({ nickname: friend.nickname, tag: friend.tag })

function FriendPicture({ friend, className }: { friend: ProfileFriend; className?: string }) {
  return (
    <Avatar className={className}>
      {friend.avatarUrl && <AvatarImage src={friend.avatarUrl} alt="" referrerPolicy="no-referrer" />}
      <AvatarFallback className="ph-mask">{initialsOf(friend.nickname)}</AvatarFallback>
    </Avatar>
  )
}

export function ProfileFriends({ friends }: { friends: readonly ProfileFriend[] }) {
  if (friends.length === 0) {
    return (
      <section aria-labelledby="friends">
        <h2 id="friends" className="mb-4 font-heading text-2xl">
          Friends
        </h2>
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No friends yet</EmptyTitle>
            <EmptyDescription>The friends you add are listed here, with the games they played.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </section>
    )
  }
  return (
    <section aria-labelledby="friends">
      <Dialog>
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 id="friends" className="font-heading text-2xl">
            Friends <span className="text-muted-foreground tabular-nums">({friends.length})</span>
          </h2>
          <DialogTrigger asChild>
            <button type="button" className="cursor-pointer text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline">
              See all<span className="sr-only"> friends</span>
            </button>
          </DialogTrigger>
        </div>
        <ul aria-label="Friends who played the most" className="flex flex-wrap gap-x-4 gap-y-5">
          {friends.slice(0, VISIBLE).map((friend, index) => (
            <li key={`${friend.nickname}#${friend.tag}`} className={index >= PHONE_VISIBLE ? "max-sm:hidden" : undefined}>
              <Link href={profilePath(handleOf(friend))} className="group/friend flex w-18 flex-col gap-2 outline-none">
                <FriendPicture friend={friend} className="size-16 group-focus-visible/friend:ring-3 group-focus-visible/friend:ring-ring/30" />
                <span title={friend.nickname} className="ph-mask w-full truncate text-sm group-hover/friend:underline">
                  {friend.nickname}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <DialogContent className="gap-0 overflow-hidden p-0">
          <DialogHeader className="p-6 pr-16">
            <DialogTitle>Friends</DialogTitle>
            <DialogDescription>
              {friends.length} {friends.length === 1 ? "friend" : "friends"}, the ones who played the most first.
            </DialogDescription>
          </DialogHeader>
          <ul className="flex max-h-[min(28rem,60svh)] flex-col overflow-y-auto overscroll-contain border-t">
            {friends.map((friend) => (
              <li key={`${friend.nickname}#${friend.tag}`} className="border-b last:border-b-0">
                <Link href={profilePath(handleOf(friend))} className="flex items-center gap-4 px-6 py-3 outline-none transition-colors duration-fast hover:bg-muted/50 focus-visible:bg-muted/50">
                  <FriendPicture friend={friend} className="size-10" />
                  <span className="ph-mask min-w-0 flex-1 truncate">{friend.nickname}</span>
                  <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{gamesText(friend.gamesPlayed)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </section>
  )
}
