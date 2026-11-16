"use client"

import { SPOKEN_LANGUAGES } from "@pbgo/accounts/language"
import { spokenLanguageName } from "@pbgo/accounts"
import { MultiSelect } from "@pbgo/ui/platform/multi-select"

/** The languages a member can say they speak: the platform's, English once, each by its name in English, with the name it has in itself under it where that is another. */
const OPTIONS = SPOKEN_LANGUAGES.map(({ id, name }) => {
  const english = spokenLanguageName(id)
  return { value: id, label: english, ...(name === english ? {} : { description: name }) }
})

/**
 * The Languages spoken field of the Edit profile window: the languages the member picked stand as chips, each with a button that takes it away, and a button opens the list of the others with a search. Any number of the platform's languages can be picked, so no counter is said;
 * the chips keep the order in which they were picked, which is the order the profile shows them in.
 */
export function LanguagesField({ value, onChange, disabled }: { value: readonly string[]; onChange: (next: string[]) => void; disabled: boolean }) {
  return (
    <MultiSelect
      className="ph-mask"
      options={OPTIONS}
      value={value}
      onValueChange={onChange}
      max={OPTIONS.length}
      placeholder="Add a language"
      searchPlaceholder="Search languages..."
      empty="No language matches."
      counter={() => ""}
      disabled={disabled}
      aria-label="Languages spoken"
    />
  )
}
