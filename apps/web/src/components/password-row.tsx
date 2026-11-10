"use client"

import { useState } from "react"
import { PASSWORD_MIN, checkPasswordChange, type PasswordProblems } from "@pbgo/accounts"
import { changePassword } from "@pbgo/accounts/client"
import { Button } from "@pbgo/ui/platform/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@pbgo/ui/platform/field"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@pbgo/ui/platform/item"
import { PasswordInput } from "@pbgo/ui/platform/password-input"
import { toast } from "@pbgo/ui/platform/sonner"
import { SettingsDialog } from "@/components/settings-dialog"
import { changing, failureOf } from "@/lib/settings-change"

/**
 * The Password row of the settings: a button that opens the window to change the password, or to set a first one for an account that came in with a provider (`hasPassword` is whether the account has the e-mail address and password
 * among its ways in). The window asks the new password twice, with the sign-up's rules (`checkPasswordChange`). The project may ask for a recent sign-in before it changes a password: the member is then told to sign in again.
 */
export function PasswordRow({ hasPassword, demo }: { hasPassword: boolean; demo: boolean }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [problems, setProblems] = useState<PasswordProblems>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function toggle(next: boolean) {
    setOpen(next)
    if (next) {
      setPassword("")
      setConfirm("")
      setProblems({})
      setError(null)
    }
  }

  async function submit() {
    const checked = checkPasswordChange(password, confirm)
    if (!checked.ok) {
      setProblems(checked.problems)
      return
    }
    setProblems({})
    setError(null)
    setPending(true)
    const outcome = await changing(demo, () => changePassword(password), { account: "password" })
    setPending(false)
    const failure = failureOf(outcome)
    if (failure) {
      setError(failure)
      return
    }
    setOpen(false)
    toast.success(hasPassword ? "Password changed" : "Password set")
  }

  return (
    <>
      <Item>
        <ItemContent>
          <ItemTitle>Password</ItemTitle>
          <ItemDescription>{hasPassword ? "The password you sign in with, with your e-mail address." : "You sign in with a service. Set a password to sign in with your e-mail address too."}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="outline" onClick={() => toggle(true)}>
            {hasPassword ? "Change" : "Set a password"}
          </Button>
        </ItemActions>
      </Item>
      <SettingsDialog
        open={open}
        onOpenChange={toggle}
        title={hasPassword ? "Change your password" : "Set a password"}
        submitLabel={hasPassword ? "Change password" : "Set password"}
        pending={pending}
        error={error}
        onSubmit={submit}
      >
        <Field data-invalid={problems.password ? true : undefined}>
          <FieldLabel htmlFor="password-field">New password</FieldLabel>
          <PasswordInput
            id="password-field"
            autoComplete="new-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              setProblems((current) => ({ ...current, password: undefined }))
            }}
            autoFocus
            disabled={pending}
            aria-invalid={problems.password ? true : undefined}
            aria-describedby={problems.password ? "password-field-error" : "password-field-hint"}
          />
          <FieldError id="password-field-error">{problems.password}</FieldError>
          {!problems.password && <FieldDescription id="password-field-hint">At least {PASSWORD_MIN} characters.</FieldDescription>}
        </Field>
        <Field data-invalid={problems.confirm ? true : undefined}>
          <FieldLabel htmlFor="password-confirm-field">Repeat the new password</FieldLabel>
          <PasswordInput
            id="password-confirm-field"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => {
              setConfirm(event.target.value)
              setProblems((current) => ({ ...current, confirm: undefined }))
            }}
            disabled={pending}
            aria-invalid={problems.confirm ? true : undefined}
            aria-describedby={problems.confirm ? "password-confirm-field-error" : undefined}
          />
          <FieldError id="password-confirm-field-error">{problems.confirm}</FieldError>
        </Field>
      </SettingsDialog>
    </>
  )
}
