import type { ReactNode } from "react"
import { cityText, countryName, initialsOf, pronounsLabel, tagText } from "@pbgo/accounts"
import { Badge } from "@pbgo/ui/platform/badge"
import { Progress } from "@pbgo/ui/platform/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@pbgo/ui/platform/avatar"
import { monthOf } from "@/lib/account-data"
import { ProfileName } from "@/components/profile-name"
import type { ProfileHead } from "@/lib/profile-data"

/**
 * The top of a profile, the member's own or anybody's: picture, nickname with the level in a badge (the number alone) at its right, the pronouns under the name (muted), the experience as a gauge under them for the member alone (`own`), since when and where (their city with its country, else their country). The tag is not drawn: it is what copying the name gives (`ProfileName`).
 * `children` are the actions (the edit button on the member's own page, "Add friend", PLT-23). `note` goes before the rest of the line.
 */
export function ProfileHeader({ head, note, own = false, children }: { head: ProfileHead; note?: string; own?: boolean; children?: ReactNode }) {
  const { pronouns, country, city } = head.details
  // Where they are: their city with its country, else their country alone
  const place = city ? cityText(city) : country ? countryName(country) : null
  const line = [note, head.memberSince ? `Member since ${monthOf(head.memberSince)}` : null, place].filter(Boolean).join(" · ")
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-4">
      <Avatar className="size-20 sm:size-24">
        {head.avatarUrl && <AvatarImage src={head.avatarUrl} alt="" referrerPolicy="no-referrer" />}
        <AvatarFallback className="ph-mask text-3xl">{initialsOf(head.nickname)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 basis-56">
        <div className="flex min-w-0 items-center gap-x-3">
          <ProfileName nickname={head.nickname} tag={head.tag === null ? null : tagText(head.tag)} className="min-w-0 truncate font-heading text-3xl sm:text-5xl" />
          {head.level && (
            <Badge variant="secondary" aria-label={`Level ${head.level.level}`} title={`Level ${head.level.level}`} className="h-7 shrink-0 px-2.5 text-sm tabular-nums">
              {head.level.level}
            </Badge>
          )}
        </div>
        {pronouns && <p className="ph-mask text-muted-foreground sm:text-lg">{pronounsLabel(pronouns)}</p>}
        {own && head.level && (
          <Progress
            value={Math.min(100, Math.max(0, (head.level.xp / head.level.xpForNext) * 100))}
            aria-label={`Experience: ${head.level.xp} of ${head.level.xpForNext} to level ${head.level.level + 1}`}
            className="mt-2 h-1.5 max-w-64"
          />
        )}
        {line && <p className="ph-mask mt-1 text-muted-foreground">{line}</p>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </header>
  )
}
