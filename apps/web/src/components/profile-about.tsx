import { isSpokenLanguage, type ProfileDetails } from "@pbgo/accounts"
import { Card, CardContent } from "@pbgo/ui/platform/card"
import { LanguageChips } from "@/components/language-chips"

/** Whether a profile has anything to say under its head about its member: a bio, or a language they speak. */
export const hasAbout = (details: ProfileDetails): boolean => details.bio !== null || details.languages.some(isSpokenLanguage)

/**
 * What a member says of themselves under the head of their profile, to every visitor, in a card of its own: the bio, as text (never markup: React escapes it, and the line breaks are kept), and under it the languages they speak, as chips. Nothing for a field that is empty, and nothing at all for a
 * profile with neither. The card of their favourite games stands just at its right (`ProfileSections`).
 */
export function ProfileAbout({ details, className }: { details: ProfileDetails; className?: string }) {
  if (!hasAbout(details)) return null
  const { bio, languages } = details
  return (
    <Card role="region" aria-label="About" className={className}>
      <CardContent className="flex min-w-0 flex-col gap-4">
        {bio !== null && <p className="ph-mask max-w-prose text-base text-pretty break-words whitespace-pre-line">{bio}</p>}
        <LanguageChips languages={languages} />
      </CardContent>
    </Card>
  )
}
