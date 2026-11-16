import { isSpokenLanguage, spokenLanguageName } from "@pbgo/accounts"
import { Badge } from "@pbgo/ui/platform/badge"
import { LanguageFlag } from "@/components/language-flag"

/**
 * The languages a member speaks, as chips in the order they put them, each with its flag and its name in English, on the fill of the cards (`bg-card`) so that they match the sections around them. A code that is not a language of the list any more is left out, and nothing is drawn for a member who speaks none.
 */
export function LanguageChips({ languages, className }: { languages: readonly string[]; className?: string }) {
  const codes = languages.filter(isSpokenLanguage)
  if (codes.length === 0) return null
  return (
    <ul aria-label="Languages spoken" className={className ?? "flex flex-wrap gap-2"}>
      {codes.map((code) => (
        <li key={code}>
          <Badge variant="secondary" className="ph-mask h-7 gap-2 bg-card px-2.5 text-sm">
            <LanguageFlag language={code} />
            {spokenLanguageName(code)}
          </Badge>
        </li>
      ))}
    </ul>
  )
}
