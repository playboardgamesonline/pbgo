"use client"

import { useState } from "react"
import { checkEmailChange } from "@pbgo/accounts"
import { changeEmail } from "@pbgo/accounts/client"
import { Button } from "@pbgo/ui/platform/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@pbgo/ui/platform/field"
import { Input } from "@pbgo/ui/platform/input"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@pbgo/ui/platform/item"
import { toast } from "@pbgo/ui/platform/sonner"
import { SettingsDialog } from "@/components/settings-dialog"
import { changing, failureOf } from "@/lib/settings-change"

/**
 * The E-mail row of the settings: the address of the account and a button that opens the window to change it. The new address does not replace the old one until the link that Supabase Auth sends there is opened (and, when the project asks both
 * addresses to confirm, the one it sends to the current address too), so the window ends with "check your e-mail" and the row keeps the address it has. The link leads back to the account's settings. A member who signed in with
 * Steam has no address (the stand-in one is never shown), and the button is off: the project would ask the stand-in address to confirm the change too, which nobody can read (docs/accounts.md, "Sign-in with Steam").
 */
export function EmailRow({ email, demo }: { email: string | null; demo: boolean }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState("")
  const [problem, setProblem] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function toggle(next: boolean) {
    setOpen(next)
    if (next) {
      setValue("")
      setProblem(null)
      setError(null)
    }
  }

  async function submit() {
    const checked = checkEmailChange(email, value)
    if (!checked.ok) {
      setProblem(checked.problem)
      return
    }
    setProblem(null)
    setError(null)
    setPending(true)
    const outcome = await changing(demo, () => changeEmail(checked.email))
    setPending(false)
    const failure = failureOf(outcome)
    if (failure) {
      setError(failure)
      return
    }
    setOpen(false)
    toast.success("Check your e-mail", { description: `We sent a link to ${checked.email}. Open it to confirm your new address.` })
  }

  return (
    <>
      <Item>
        <ItemContent>
          <ItemTitle>E-mail address</ItemTitle>
          <ItemDescription className="ph-mask">{email ?? "No e-mail address"}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="outline" onClick={() => toggle(true)} disabled={email === null}>
            Change
          </Button>
        </ItemActions>
      </Item>
      <SettingsDialog
        open={open}
        onOpenChange={toggle}
        title="Change your e-mail address"
        description="We send a link to the new address. Your address changes once you open it."
        submitLabel="Send the link"
        pending={pending}
        error={error}
        onSubmit={submit}
      >
        <Field data-invalid={problem ? true : undefined}>
          <FieldLabel htmlFor="email-field">New e-mail address</FieldLabel>
          <Input
            id="email-field"
            className="ph-mask"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
              setProblem(null)
            }}
            autoFocus
            disabled={pending}
            aria-invalid={problem ? true : undefined}
            aria-describedby={problem ? "email-field-error" : undefined}
          />
          <FieldError id="email-field-error">{problem}</FieldError>
          {email && <FieldDescription>Your current address is {email}.</FieldDescription>}
        </Field>
      </SettingsDialog>
    </>
  )
}
