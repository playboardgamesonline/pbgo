import type { ProfileDetails } from "@pbgo/accounts"

/**
 * What a member says of themselves under the head of their profile, to every visitor: the bio, as text (never markup: React escapes it, and the line breaks are kept). Nothing for a profile with no bio. The games they play the most are not here: nobody picks them, and they are drawn with the rest of what
 * the games say (`ProfileSections`).
 */
export function ProfileAbout({ details }: { details: ProfileDetails }) {
  const { bio } = details
  if (bio === null) return null
  return (
    <section aria-label="About" className="pt-6">
      <p className="ph-mask max-w-prose text-pretty break-words whitespace-pre-line">{bio}</p>
    </section>
  )
}
