import { isSpokenLanguage, type ProfileDetails } from "@pbgo/accounts"
import { cn } from "@pbgo/ui/utils"
import { LanguageChips } from "@/components/language-chips"

/** Whether a profile has anything to say under its head about its member: a bio, or a language they speak. */
export const hasAbout = (details: ProfileDetails): boolean => details.bio !== null || details.languages.some(isSpokenLanguage)

/**
 * What a member says of themselves under the head of their profile, to every visitor: the bio, as text (never markup: React escapes it, and the line breaks are kept), and under it the languages they speak, as chips. Nothing for a field that is empty, and nothing at all for a profile with
 * neither. It stands at the left of their favourite games, which `ProfileSections` puts at its right.
 */
export function ProfileAbout({ details, className }: { details: ProfileDetails; className?: string }) {
  if (!hasAbout(details)) return null
  const { bio, languages } = details
  return (
    <section aria-label="About" className={cn("flex min-w-0 flex-col gap-4", className)}>
      {bio !== null && <p className="ph-mask max-w-prose text-base text-pretty break-words whitespace-pre-line">{bio}</p>}
      <LanguageChips languages={languages} />
    </section>
  )
}
