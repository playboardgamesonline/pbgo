"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { checkCountry } from "@pbgo/accounts"
import { saveCountry } from "@pbgo/accounts/client"
import { InlineEdit, InlineField, InlineFieldSelectTrigger } from "@pbgo/ui/platform/inline-edit"
import { Select, SelectContent, SelectItem, SelectValue } from "@pbgo/ui/platform/select"
import { toast } from "@pbgo/ui/platform/sonner"
import { changing, failureOf } from "@/lib/settings-change"

/** What the picker holds for "no country": a word of its own, since an item of a select cannot have an empty value. */
const NONE = "none"

/**
 * The Country / region row of the settings: where the member is, an optional detail kept on their account (`saveCountry`, as the ISO code) and edited where it stands (`InlineEdit`). The names are English and come from the server, which draws them
 * once (`countryOptions`), so that the browser never draws a name of its own for the same code. Only the code is kept, and nothing reads it as a permission.
 */
export function CountryRow({ country, options, demo }: { country: string | null; options: readonly { code: string; name: string }[]; demo: boolean }) {
  const router = useRouter()
  const [saved, setSaved] = useState(country)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(country ?? NONE)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const nameOf = (code: string | null): string | null => (code === null ? null : (options.find((option) => option.code === code)?.name ?? code))
  const checked = checkCountry(draft === NONE ? "" : draft)

  function toggle(next: boolean) {
    setOpen(next)
    if (next) {
      setDraft(saved ?? NONE)
      setError(null)
    }
  }

  async function submit() {
    if (!checked.ok) return
    const country = checked.country
    setError(null)
    setPending(true)
    const outcome = await changing(demo, () => saveCountry(country))
    setPending(false)
    const failure = failureOf(outcome)
    if (failure) {
      setError(failure)
      return
    }
    setSaved(country)
    setOpen(false)
    toast.success(country === null ? "Country removed" : "Country saved")
    router.refresh()
  }

  return (
    <InlineEdit
      open={open}
      onOpenChange={toggle}
      title="Country / region"
      value={<span className="ph-mask">{nameOf(saved) ?? "Not set"}</span>}
      editLabel="Edit country or region"
      canSave={checked.ok && checked.country !== saved}
      pending={pending}
      error={error}
      onSave={submit}
    >
      <InlineField label="Country / region" htmlFor="country-field">
        <Select
          value={draft}
          onValueChange={(value) => {
            setDraft(value)
            setError(null)
          }}
          disabled={pending}
        >
          <InlineFieldSelectTrigger id="country-field" className="ph-mask">
            <SelectValue>{nameOf(draft === NONE ? null : draft) ?? "Not set"}</SelectValue>
          </InlineFieldSelectTrigger>
          <SelectContent position="popper" align="start" className="max-h-72">
            <SelectItem value={NONE}>Not set</SelectItem>
            {options.map((option) => (
              <SelectItem key={option.code} value={option.code}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </InlineField>
    </InlineEdit>
  )
}
