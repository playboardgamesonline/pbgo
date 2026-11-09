import { BD, CN, DE, ES, FR, IN, JP, KR, PT, RU, SA, US } from "country-flag-icons/react/3x2"
import { PLATFORM_LANGUAGE_REGIONS, type LanguageRegion, type PlatformLanguage } from "@pbgo/accounts"
import { cn } from "@pbgo/ui/utils"

/** The flags of the countries that `PLATFORM_LANGUAGE_REGIONS` names, and only those: a language that gets a new country does not compile until its flag is imported here. Each is its own module, so only these twelve are shipped. */
const FLAGS: Record<LanguageRegion, typeof US> = { BD, CN, DE, ES, FR, IN, JP, KR, PT, RU, SA, US }

/**
 * The flag of a language, in the pickers: a small rectangle with a rounded corner, 3 wide for 2 high, and a hairline so that a flag with white in it keeps its edge on the dark. It is only a picture beside the name of the language, which says it,
 * so it is hidden from a screen reader. The pictures are those of the `country-flag-icons` package (MIT), drawn in the page as they are: nothing is asked of a server for them.
 */
export function LanguageFlag({ language, className }: { language: PlatformLanguage; className?: string }) {
  const Flag = FLAGS[PLATFORM_LANGUAGE_REGIONS[language]]
  // The size is the wrapper's and the picture fills it: a select gives every svg inside it a square of its own unless its class says `size-`
  return (
    <span aria-hidden="true" className={cn("inline-block h-4 w-6 shrink-0 overflow-hidden rounded-sm ring-1 ring-foreground/10", className)}>
      <Flag focusable="false" className="block size-full" />
    </span>
  )
}
