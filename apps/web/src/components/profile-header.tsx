import type { ReactNode } from "react"
import { countryName, initialsOf, pronounsLabel, tagText } from "@pbgo/accounts"
import { Avatar, AvatarFallback, AvatarImage } from "@pbgo/ui/platform/avatar"
import { monthOf } from "@/lib/account-data"
import type { ProfileHead } from "@/lib/profile-data"

/**
 * The top of a profile, the member's own or anybody's: picture, nickname with tag, the pronouns beside it (muted), the country and since when. `children` are the actions (the edit button on the member's own page, "Add friend", PLT-23). `note` goes before the rest of the line.
 */
export function ProfileHeader({ head, note, children }: { head: ProfileHead; note?: string; children?: ReactNode }) {
  const { pronouns, country } = head.details
  const line = [note, head.memberSince ? `Member since ${monthOf(head.memberSince)}` : null, country ? countryName(country) : null].filter(Boolean).join(" · ")
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-4">
      <Avatar className="size-20 sm:size-24">
        {head.avatarUrl && <AvatarImage src={head.avatarUrl} alt="" referrerPolicy="no-referrer" />}
        <AvatarFallback className="ph-mask text-3xl">{initialsOf(head.nickname)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 basis-56">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
          <h1 className="ph-mask min-w-0 truncate font-heading text-3xl sm:text-5xl">
            {head.nickname}
            {head.tag !== null && <span className="text-muted-foreground">#{tagText(head.tag)}</span>}
          </h1>
          {pronouns && <p className="ph-mask text-muted-foreground sm:text-lg">{pronounsLabel(pronouns)}</p>}
        </div>
        {line && <p className="ph-mask mt-1 text-muted-foreground">{line}</p>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </header>
  )
}
