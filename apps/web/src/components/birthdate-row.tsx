"use client"

import { useRouter } from "next/navigation"
import { useState, type ChangeEvent } from "react"
import { birthYearOf, birthdateFields, calendarDateOf, checkBirthdate, type BirthdateField, type BirthdateFields } from "@pbgo/accounts"
import { saveBirthdate } from "@pbgo/accounts/client"
import { InlineEdit, InlineField, InlineFieldInput } from "@pbgo/ui/platform/inline-edit"
import { toast } from "@pbgo/ui/platform/sonner"
import { changing, failureOf } from "@/lib/settings-change"

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
 * The Date of birth row of the settings: an optional detail kept on the member's account (`saveBirthdate`) and edited where it stands (`InlineEdit`), in three fields, the day, the month and the year. Closed, it shows the year and hides the rest.
 * What is typed is judged by `checkBirthdate` as it is typed once the three fields are full: it has to be a day that exists, not in the future, not 120 years back, and the member has to be 13 or older, which is what the Terms ask: a date that makes
 * them younger is refused in words and is not kept. All three fields empty takes the date away. Nothing reads the date as a permission.
 */
export function BirthdateRow({ birthdate, demo }: { birthdate: string | null; demo: boolean }) {
  const router = useRouter()
  const [saved, setSaved] = useState(birthdate)
  const [open, setOpen] = useState(false)
  const [fields, setFields] = useState<BirthdateFields>(() => birthdateFields(birthdate))
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const checked = checkBirthdate(fields, calendarDateOf(new Date()))
  // A date that is half typed is not a mistake yet: what is wrong with it is said once the three fields are full
  const full = fields.day !== "" && fields.month !== "" && fields.year !== ""
  const problem = !checked.ok && full ? checked : null

  function toggle(next: boolean) {
    setOpen(next)
    if (next) {
      setFields(birthdateFields(saved))
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
    if (!checked.ok) return
    const date = checked.birthdate
    setError(null)
    setPending(true)
    const outcome = await changing(demo, () => saveBirthdate(date))
    setPending(false)
    const failure = failureOf(outcome)
    if (failure) {
      setError(failure)
      return
    }
    setSaved(date)
    setOpen(false)
    toast.success(date === null ? "Date of birth removed" : "Date of birth saved")
    router.refresh()
  }

  const invalid = (field: BirthdateField) => (problem !== null && (problem.field === field || problem.field === null) ? true : undefined)

  return (
    <InlineEdit
      open={open}
      onOpenChange={toggle}
      title="Date of birth"
      value={saved === null ? "Not set" : <MaskedBirthdate birthdate={saved} />}
      editLabel="Edit date of birth"
      canSave={checked.ok && checked.birthdate !== saved}
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
    </InlineEdit>
  )
}
