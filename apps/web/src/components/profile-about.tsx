import type { ProfileDetails } from "@pbgo/accounts"
import { LanguageChips } from "@/components/language-chips"

/**
 * What a member says of themselves under the head of their profile, to every visitor: the bio, as text (never markup: React escapes it, and the line breaks are kept), and under it the languages they speak, as chips. Nothing for a field that is empty, and nothing at all for a profile with
 * neither. The games they play the most are not here: nobody picks them, and they are drawn with the rest of what the games say (`ProfileSections`).
 */
export function ProfileAbout({ details }: { details: ProfileDetails }) {
  const { bio, languages } = details
  if (bio === null && languages.length === 0) return null
  return (
    <section aria-label="About" className="flex flex-col gap-4 pt-6">
      {bio !== null && <p className="ph-mask max-w-prose text-pretty break-words whitespace-pre-line">{bio}</p>}
      <LanguageChips languages={languages} />
    </section>
  )
}
