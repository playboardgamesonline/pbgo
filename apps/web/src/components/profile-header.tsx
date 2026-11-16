import type { ReactNode } from "react"
import { cityText, countryName, initialsOf, pronounsLabel, tagText } from "@pbgo/accounts"
import { Badge } from "@pbgo/ui/platform/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@pbgo/ui/platform/avatar"
import { monthOf } from "@/lib/account-data"
import { ProfileName } from "@/components/profile-name"
import type { ProfileHead } from "@/lib/profile-data"

/**
 * The top of a profile, the member's own or anybody's: picture, nickname with its tag in a frame at its right (`#0042`, a little smaller than the name) and the level in a badge after it (the number alone), the pronouns under the name (muted) with where they are at their right, after a dot (their city with its country, else their country), and since when, small and quiet. The tag is not drawn: it is what copying the name gives (`ProfileName`). No gauge of the experience: the level says it.
 * `children` are the actions (the edit button on the member's own page, "Add friend", PLT-23). `note` goes before the since-when line's text.
 */
export function ProfileHeader({ head, note, children }: { head: ProfileHead; note?: string; children?: ReactNode }) {
  const { pronouns, country, city } = head.details
  // Where they are: their city with its country, else their country alone
  const place = city ? cityText(city) : country ? countryName(country) : null
  // The pronouns and where they are share a line, after the same dot; since when is a line of its own, smaller and quieter
  const identity = [pronouns ? pronounsLabel(pronouns) : null, place].filter(Boolean).join(" · ")
  const since = [note, head.memberSince ? `Member since ${monthOf(head.memberSince)}` : null].filter(Boolean).join(" · ")
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-4">
      <Avatar className="size-20 sm:size-24">
        {head.avatarUrl && <AvatarImage src={head.avatarUrl} alt="" referrerPolicy="no-referrer" />}
        <AvatarFallback className="ph-mask text-3xl">{initialsOf(head.nickname)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 basis-56">
        <div className="flex min-w-0 items-center gap-x-3">
          <ProfileName nickname={head.nickname} tag={head.tag === null ? null : tagText(head.tag)} className="min-w-0 truncate font-heading text-3xl sm:text-5xl" />
          {head.tag !== null && (
            <Badge variant="outline" aria-label={`Tag ${tagText(head.tag)}`} className="ph-mask h-6 shrink-0 px-2 text-sm tabular-nums sm:h-7 sm:px-2.5 sm:text-base">
              #{tagText(head.tag)}
            </Badge>
          )}
          <Badge variant="secondary" aria-label={`Level ${head.level.level}`} title={`Level ${head.level.level}`} className="h-7 shrink-0 px-2.5 text-sm tabular-nums">
            {head.level.level}
          </Badge>
        </div>
        {identity && <p className="ph-mask mt-1.5 text-muted-foreground sm:mt-2.5 sm:text-lg">{identity}</p>}
        {since && <p className="ph-mask mt-1 text-sm text-muted-foreground/60">{since}</p>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </header>
  )
}
