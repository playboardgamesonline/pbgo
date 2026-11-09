"use client"

import { useCallback, useRef, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { birthdateProblem, type AgeRefusal } from "@pbgo/accounts"
import { ApiClientError, gameRequest } from "@pbgo/core/lib/api"
import { Button } from "@pbgo/ui/platform/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@pbgo/ui/platform/dialog"
import { Field, FieldError, FieldLabel } from "@pbgo/ui/platform/field"
import { Input } from "@pbgo/ui/platform/input"
import { toast } from "@pbgo/ui/platform/sonner"
import { messageOf } from "@/lib/table-door"

// What a visitor is told, and asked, when a game or an expansion asks for an age (PLT-125). The server decides (`@pbgo/core/server/age-gate`: a guest signs in, a member adds their date of birth, a member too young is refused); this is how the pages say it.
// `useAgeGate` is for the components that call a game's routes: `guard` runs a call and, when the server asks for the date of birth, asks the visitor for it in a dialog and runs the call again; `demand` does the same for what the page already knows
// (the queue of a game for adults, which has no server to ask); `fail` tells any other refusal, a guest being offered the way to sign in. The date is declared once and never changed afterwards, and the dialog says so.

/** The wording of a refusal, as the platform words it (`CORE_ERROR_MESSAGES`). */
const wording = (code: string) => new ApiClientError(code).message

/** Digits only, no more than `max` of them. */
const digits = (value: string, max: number) => value.replace(/\D/g, "").slice(0, max)

/**
 * What is in the window that asks for the date of birth: three fields, the day, the month and the year. What is typed is judged as the server judges it (`birthdateProblem`, so that a mistake is told at once; the server judges all the same), and the date is declared with
 * `POST /api/hub/birthdate`, which keeps it once. Saying so is its first line: a date that cannot be changed is not typed lightly. The window is closed when nothing is asked, so the form starts from nothing each time it is opened.
 */
function BirthdateForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [day, setDay] = useState("")
  const [month, setMonth] = useState("")
  const [year, setYear] = useState("")
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const monthField = useRef<HTMLInputElement>(null)
  const yearField = useRef<HTMLInputElement>(null)
  const ready = day !== "" && month !== "" && year.length === 4

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!ready || saving) return
    const birthdate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
    const wrong = birthdateProblem(birthdate, new Date())
    if (wrong) {
      setProblem(wording(wrong === "under-minimum" ? "BIRTHDATE_UNDER_MINIMUM" : "BIRTHDATE_INVALID"))
      return
    }
    setProblem(null)
    setSaving(true)
    try {
      await gameRequest("/api/hub/birthdate", { method: "POST", body: JSON.stringify({ birthdate }) })
      onSaved()
    } catch (error) {
      setProblem(messageOf(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-6">
      <DialogHeader>
        <DialogTitle>Add your date of birth</DialogTitle>
        <DialogDescription>Some games and expansions are for adults only. We use your date of birth to check that, and nothing else. Other players never see it. Enter your real date: you can&apos;t change it afterwards.</DialogDescription>
      </DialogHeader>
      <Field>
        <FieldLabel htmlFor="age-gate-day">Date of birth</FieldLabel>
        <div role="group" aria-label="Date of birth" className="grid grid-cols-[1fr_1fr_1.6fr] gap-3">
          <Input
            id="age-gate-day"
            aria-label="Day"
            placeholder="DD"
            inputMode="numeric"
            autoComplete="bday-day"
            autoFocus
            value={day}
            onChange={(event) => {
              const next = digits(event.target.value, 2)
              setDay(next)
              setProblem(null)
              if (next.length === 2) monthField.current?.focus()
            }}
            aria-invalid={problem ? true : undefined}
            disabled={saving}
          />
          <Input
            ref={monthField}
            aria-label="Month"
            placeholder="MM"
            inputMode="numeric"
            autoComplete="bday-month"
            value={month}
            onChange={(event) => {
              const next = digits(event.target.value, 2)
              setMonth(next)
              setProblem(null)
              if (next.length === 2) yearField.current?.focus()
            }}
            aria-invalid={problem ? true : undefined}
            disabled={saving}
          />
          <Input
            ref={yearField}
            aria-label="Year"
            placeholder="YYYY"
            inputMode="numeric"
            autoComplete="bday-year"
            value={year}
            onChange={(event) => {
              setYear(digits(event.target.value, 4))
              setProblem(null)
            }}
            aria-invalid={problem ? true : undefined}
            disabled={saving}
          />
        </div>
        <FieldError>{problem}</FieldError>
      </Field>
      <DialogFooter>
        <Button type="button" variant="secondary" size="lg" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={!ready || saving}>
          Save
        </Button>
      </DialogFooter>
    </form>
  )
}

/** The window that asks for the date of birth (`BirthdateForm`), open while a visitor is being asked. */
function BirthdateDialog({ open, onSaved, onCancel }: { open: boolean; onSaved: () => void; onCancel: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent>
        <BirthdateForm onSaved={onSaved} onCancel={onCancel} />
      </DialogContent>
    </Dialog>
  )
}

/** Where a guest signs in to come back to the page they are on. */
const loginHref = () => `/login?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`

/**
 * The three things a component that calls a game's routes does about the age (PLT-125), and the `dialog` to render beside it, as `useSitDown` does for the nickname:
 * - `guard(call)` runs the call; when the server answers that the date of birth is missing (`AGE_DATE_REQUIRED`), the visitor is asked for it and the call runs again once they have declared it. If they give up, the first answer is thrown.
 * - `demand(refusal)` for what the page knows already (`AgeStates`): true when there is nothing to do or the visitor has just declared their date; a guest or a member who is too young is told, and it is false.
 * - `fail(error)` tells a refusal: the platform's words in a toast, with a way to sign in for a guest.
 */
export function useAgeGate() {
  const router = useRouter()
  const [asking, setAsking] = useState<((declared: boolean) => void) | null>(null)

  const askDate = useCallback(() => new Promise<boolean>((resolve) => setAsking(() => resolve)), [])

  const fail = useCallback((error: unknown) => {
    if (error instanceof ApiClientError && error.code === "AGE_SIGN_IN_REQUIRED") {
      toast.error(error.message, { action: { label: "Sign in", onClick: () => window.location.assign(loginHref()) } })
      return
    }
    toast.error(messageOf(error))
  }, [])

  const guard = useCallback(
    async <T,>(call: () => Promise<T>): Promise<T> => {
      try {
        return await call()
      } catch (error) {
        if (!(error instanceof ApiClientError) || error.code !== "AGE_DATE_REQUIRED") throw error
        if (!(await askDate())) throw error
        return call()
      }
    },
    [askDate],
  )

  const demand = useCallback(
    async (refusal: AgeRefusal | null): Promise<boolean> => {
      if (refusal === null) return true
      if (refusal === "date") return askDate()
      fail(new ApiClientError(refusal === "sign-in" ? "AGE_SIGN_IN_REQUIRED" : "AGE_TOO_YOUNG"))
      return false
    },
    [askDate, fail],
  )

  const dialog = (
    <BirthdateDialog
      open={asking !== null}
      onSaved={() => {
        asking?.(true)
        setAsking(null)
        // What the page said of the visitor's age (the locks, the buttons) is the server's, and it has changed
        router.refresh()
      }}
      onCancel={() => {
        asking?.(false)
        setAsking(null)
      }}
    />
  )
  return { guard, demand, fail, dialog }
}
