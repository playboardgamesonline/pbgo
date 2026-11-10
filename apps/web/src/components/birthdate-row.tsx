"use client"

import { useRouter } from "next/navigation"
import { useState, type ChangeEvent } from "react"
import { birthYearOf, birthdateFields, calendarDateOf, checkBirthdate, type BirthdateField, type BirthdateFields } from "@pbgo/accounts"
import { trackClient } from "@pbgo/analytics/client"
import { gameRequest } from "@pbgo/core/lib/api"
import { InlineEdit, InlineField, InlineFieldInput } from "@pbgo/ui/platform/inline-edit"
import { Item, ItemContent, ItemDescription, ItemTitle } from "@pbgo/ui/platform/item"
import { toast } from "@pbgo/ui/platform/sonner"
import { messageOf } from "@/lib/table-door"
import { CONTACT } from "@/site"

/** What a field of the date holds at most, in digits. */
const DIGITS: Record<BirthdateField, number> = { day: 2, month: 2, year: 4 }

/** What the closed row says of a date that is kept: the day and the month hidden, the year in the open, so that the row says something and gives away little to whoever glances at the screen. Read aloud, it is the year alone. */
function MaskedBirthdate({ birthdate }: { birthdate: string }) {
  return (
    <span className="ph-mask tabular-nums">
      <span aria-hidden="true">•• | •• | {birthYearOf(birthdate)}</span>
      <span className="sr-only">Born in {birthYearOf(birthdate)}</span>
    </span>
  )
}

/**
 * The Date of birth row of the settings: the member declares their date of birth once, to the server (`POST /api/hub/birthdate`), which keeps it where only the server reads it, for the games and expansions that ask for an age (PLT-125, `docs/accounts.md`,
 * "The age check"). It is edited where it stands (`InlineEdit`), in three fields, the day, the month and the year, judged as the server judges them (`checkBirthdate`, on the UTC calendar): it has to be a day that exists, not in the future, not 120 years
 * back, and the member has to be 13 or older, which is what the Terms ask. The editor says that the date can be given once. When one is kept the row shows the year and hides the rest, has no button, and says that it cannot be changed and who to write to if it is wrong:
 * the server never replaces a date, so a refusal for a member's age cannot be got round by declaring another.
 */
export function BirthdateRow({ birthdate }: { birthdate: string | null }) {
  const router = useRouter()
  const [saved, setSaved] = useState(birthdate)
  const [open, setOpen] = useState(false)
  const [fields, setFields] = useState<BirthdateFields>(() => birthdateFields(null))
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const checked = checkBirthdate(fields, calendarDateOf(new Date()))
  // A date that is half typed is not a mistake yet: what is wrong with it is said once the three fields are full
  const full = fields.day !== "" && fields.month !== "" && fields.year !== ""
  const problem = !checked.ok && full ? checked : null

  function toggle(next: boolean) {
    setOpen(next)
    if (next) {
      setFields(birthdateFields(null))
      setError(null)
    }
  }

  function type(field: BirthdateField) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const digits = event.target.value.replace(/\D/g, "").slice(0, DIGITS[field])
      setFields((current) => ({ ...current, [field]: digits }))
      setError(null)
      // The cursor moves on by itself when a field is full, with what the next one holds selected so that it is typed over
      if (digits.length === DIGITS[field]) {
        const inputs = [...(event.target.closest('[role="group"]')?.querySelectorAll("input") ?? [])]
        const next = inputs[inputs.indexOf(event.target) + 1]
        next?.focus()
        next?.select()
      }
    }
  }

  async function submit() {
    if (!checked.ok || checked.birthdate === null) return
    const date = checked.birthdate
    setError(null)
    setPending(true)
    try {
      await gameRequest("/api/hub/birthdate", { method: "POST", body: JSON.stringify({ birthdate: date }) })
      trackClient("setting_changed", { setting: "birthdate" })
      setSaved(date)
      setOpen(false)
      toast.success("Date of birth saved")
      router.refresh()
    } catch (failure) {
      setError(messageOf(failure))
    } finally {
      setPending(false)
    }
  }

  if (saved !== null) {
    return (
      <Item>
        <ItemContent>
          <ItemTitle>Date of birth</ItemTitle>
          <ItemDescription>
            <MaskedBirthdate birthdate={saved} />
          </ItemDescription>
          <ItemDescription>It can&apos;t be changed. Write to {CONTACT} if it is wrong.</ItemDescription>
        </ItemContent>
      </Item>
    )
  }

  const invalid = (field: BirthdateField) => (problem !== null && (problem.field === field || problem.field === null) ? true : undefined)

  return (
    <InlineEdit
      open={open}
      onOpenChange={toggle}
      title="Date of birth"
      value="Not set"
      editLabel="Add date of birth"
      saveLabel="Save date of birth"
      canSave={checked.ok && checked.birthdate !== null}
      pending={pending}
      error={error}
      onSave={submit}
    >
      <InlineField label="Date of birth" htmlFor="birthdate-day" error={problem?.problem}>
        <div role="group" aria-label="Date of birth" className="flex items-center gap-3">
          <InlineFieldInput
            id="birthdate-day"
            name="bday-day"
            aria-label="Day"
            placeholder="DD"
            inputMode="numeric"
            data-autoselect
            autoComplete="bday-day"
            className="ph-mask w-9 tabular-nums"
            value={fields.day}
            onChange={type("day")}
            disabled={pending}
            aria-invalid={invalid("day")}
            aria-describedby={problem ? "birthdate-day-error" : undefined}
          />
          <span aria-hidden="true" className="h-4 w-px bg-border" />
          <InlineFieldInput
            id="birthdate-month"
            name="bday-month"
            aria-label="Month"
            placeholder="MM"
            inputMode="numeric"
            data-autoselect
            autoComplete="bday-month"
            className="ph-mask w-9 tabular-nums"
            value={fields.month}
            onChange={type("month")}
            disabled={pending}
            aria-invalid={invalid("month")}
            aria-describedby={problem ? "birthdate-day-error" : undefined}
          />
          <span aria-hidden="true" className="h-4 w-px bg-border" />
          <InlineFieldInput
            id="birthdate-year"
            name="bday-year"
            aria-label="Year"
            placeholder="YYYY"
            inputMode="numeric"
            data-autoselect
            autoComplete="bday-year"
            className="ph-mask w-14 tabular-nums"
            value={fields.year}
            onChange={type("year")}
            disabled={pending}
            aria-invalid={invalid("year")}
            aria-describedby={problem ? "birthdate-day-error" : undefined}
          />
        </div>
      </InlineField>
      <p className="text-sm text-muted-foreground">You can give it once. It can&apos;t be changed afterwards, and other players never see it.</p>
    </InlineEdit>
  )
}
