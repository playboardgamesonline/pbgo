import { isSpokenLanguage, type ProfileDetails } from "@pbgo/accounts"
import { Card, CardContent } from "@pbgo/ui/platform/card"
import { StatBarLabel } from "@pbgo/ui/platform/stat-bar"
import { cn } from "@pbgo/ui/utils"
import { LanguageChips } from "@/components/language-chips"

/** Whether a profile has anything to say under its head about its member: a bio, or a language they speak. */
export const hasAbout = (details: ProfileDetails): boolean => details.bio !== null || details.languages.some(isSpokenLanguage)

/**
 * What a member says of themselves under the head of their profile, to every visitor: the bio, as text (never markup: React escapes it, and the line breaks are kept), in a card of its own, and under that card the languages they speak, as chips that each have their own fill. Nothing for a field that
 * is empty, and nothing at all for a profile with neither. The card of their favourite games stands just at its right (`ProfileSections`).
 */
export function ProfileAbout({ details, className }: { details: ProfileDetails; className?: string }) {
  if (!hasAbout(details)) return null
  const { bio, languages } = details
  return (
    <section aria-label="About" className={cn("flex min-w-0 flex-col gap-3", className)}>
      {bio !== null && (
        <Card className="flex-1">
          <CardContent>
            <StatBarLabel className="mb-3 block">Bio</StatBarLabel>
            <p className="ph-mask max-w-prose text-base text-pretty break-words whitespace-pre-line">{bio}</p>
          </CardContent>
        </Card>
      )}
      <LanguageChips languages={languages} />
    </section>
  )
}
