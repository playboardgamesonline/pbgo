import { PROVIDER_NAMES, initialsOf, type Account } from "@pbgo/accounts"
import { Avatar, AvatarFallback, AvatarImage } from "@pbgo/ui/platform/avatar"
import type { Friend } from "@pbgo/ui/platform/friends-panel"
import { FriendsSheet } from "@/components/friends-sheet"
import { monthOf } from "@/lib/account-data"

/** The line under the name: how the visitor signed in, and since when they have an account. */
function lineOf(account: Account): string {
  const how = account.provider ? `Signed in with ${PROVIDER_NAMES[account.provider]}` : "Demo account (development only)"
  return account.createdAt ? `${how} · member since ${monthOf(account.createdAt)}` : how
}

/**
 * The top of every page of an account: the picture (the initials when the provider gives none), the name, how they signed in, and, on a screen with no
 * room for the friends' panel, the button that opens it.
 */
export function ProfileHeader({ account, friends, preview }: { account: Account; friends: readonly Friend[]; preview: boolean }) {
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-4">
      <Avatar className="size-20 sm:size-24">
        {account.avatarUrl && <AvatarImage src={account.avatarUrl} alt="" referrerPolicy="no-referrer" />}
        <AvatarFallback className="text-3xl">{initialsOf(account.nickname)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 basis-56">
        <h1 className="truncate font-heading text-3xl sm:text-5xl">{account.nickname}</h1>
        <p className="mt-1 text-muted-foreground">{lineOf(account)}</p>
      </div>
      <FriendsSheet friends={friends} preview={preview} className="lg:hidden" />
    </header>
  )
}
