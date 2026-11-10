import type { ReactNode } from "react"
import { initialsOf, tagText } from "@pbgo/accounts"
import { Avatar, AvatarFallback, AvatarImage } from "@pbgo/ui/platform/avatar"
import { monthOf } from "@/lib/account-data"
import type { ProfileHead } from "@/lib/profile-data"

/**
 * The top of a profile, the member's own or anybody's: picture, nickname with tag, since when. `children` are the actions (edit buttons on the member's own page, "Add friend" later, PLT-23). `note` goes before "member since".
 */
export function ProfileHeader({ head, note, children }: { head: ProfileHead; note?: string; children?: ReactNode }) {
  const line = [note, head.memberSince ? `Member since ${monthOf(head.memberSince)}` : null].filter(Boolean).join(" · ")
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-4">
      <Avatar className="size-20 sm:size-24">
        {head.avatarUrl && <AvatarImage src={head.avatarUrl} alt="" referrerPolicy="no-referrer" />}
        <AvatarFallback className="ph-mask text-3xl">{initialsOf(head.nickname)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 basis-56">
        <h1 className="ph-mask truncate font-heading text-3xl sm:text-5xl">
          {head.nickname}
          {head.tag !== null && <span className="text-muted-foreground">#{tagText(head.tag)}</span>}
        </h1>
        {line && <p className="mt-1 text-muted-foreground">{line}</p>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </header>
  )
}
