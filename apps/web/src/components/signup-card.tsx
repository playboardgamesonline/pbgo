"use client"

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import Link from "next/link"
import { AFTER_SIGN_IN, DISPLAY_NAME_MAX, PASSWORD_MIN, RESEND_SECONDS, checkSignup, type Provider, type SignupFields, type SignupProblems } from "@pbgo/accounts"
import { signInWith, signUpWithPassword } from "@pbgo/accounts/client"
import { Alert, AlertDescription } from "@pbgo/ui/platform/alert"
import { Button } from "@pbgo/ui/platform/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@pbgo/ui/platform/field"
import { Input } from "@pbgo/ui/platform/input"
import { PasswordInput } from "@pbgo/ui/platform/password-input"
import { Spinner } from "@pbgo/ui/platform/spinner"
import { cn } from "@pbgo/ui/utils"
import { ProviderRow } from "@/components/provider-row"
import { SignupCode } from "@/components/signup-code"
import { useCountdown } from "@/lib/use-countdown"

/** The order of the fields on the screen: where the focus goes first when more than one is wrong. */
const FIELDS = ["email", "password", "name"] as const

/**
 * The sign-up, a card laid over the hub's backdrop like the sign-in's: an e-mail address, a password and a display name that may be left empty, a line about the Terms and the minimum age, then, under "or continue with", the
 * providers that the project has switched on (`providers`: a provider's sign-in makes an account too). It has two steps. The form checks what it can before anything leaves (`checkSignup`), then asks Supabase Auth to create the account; nobody is signed in yet, an e-mail with a code and a link
 * goes to the address, and the card turns to the code (`SignupCode`), which confirms the address and signs the visitor in on `next`. An address that already has an account goes through the same steps, and nothing is sent: the page never says which
 * addresses are taken. Without a Supabase project (`enabled` is false) everything is off and says so, and `linkFailed` is the page's way to tell a visitor that the link of the e-mail did not work (`/auth/confirm`).
 */
export function SignupCard({ next, enabled, providers, linkFailed, className }: { next: string; enabled: boolean; providers: Provider[]; linkFailed: boolean; className?: string }) {
  const [step, setStep] = useState<"form" | "code">("form")
  const [fields, setFields] = useState<SignupFields>({ email: "", password: "", name: "" })
  const [problems, setProblems] = useState<SignupProblems>({})
  // What is on its way: the form, or a provider. While it is, nothing else can be pressed
  const [pending, setPending] = useState<Provider | "signup" | null>(null)
  const loginHref = next === AFTER_SIGN_IN ? "/login" : `/login?next=${encodeURIComponent(next)}`
  const [error, setError] = useState<ReactNode>(
    linkFailed ? (
      <>
        That link has expired or was already used. If your address is confirmed, <Link href={loginHref}>sign in</Link>. If not, create the account again to get a new code.
      </>
    ) : null,
  )
  const [sentTo, setSentTo] = useState("")
  const [waiting, startWaiting] = useCountdown()
  const form = useRef<HTMLFormElement>(null)
  // The field to put the focus in once the form is back: it is disabled while a request is on its way
  const focusAfter = useRef<keyof SignupFields | null>(null)
  const off = !enabled || pending !== null

  useEffect(() => {
    if (pending !== null || focusAfter.current === null) return
    const field = form.current?.elements.namedItem(focusAfter.current)
    focusAfter.current = null
    if (field instanceof HTMLElement) field.focus()
  })

  function edit(key: keyof SignupFields) {
    return (event: { target: { value: string } }) => {
      setFields((current) => ({ ...current, [key]: event.target.value }))
      setProblems((current) => {
        const rest = { ...current }
        delete rest[key]
        return rest
      })
    }
  }

  async function start(provider: Provider) {
    setPending(provider)
    setError(null)
    const problem = await signInWith(provider, next)
    // On its way to the provider the page just goes: only a refusal comes back here
    if (problem) {
      setPending(null)
      setError(problem)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const checked = checkSignup(fields)
    if (!checked.ok) {
      setProblems(checked.problems)
      focusAfter.current = FIELDS.find((key) => checked.problems[key]) ?? null
      return
    }
    setProblems({})
    setPending("signup")
    const outcome = await signUpWithPassword({ ...checked.entry, next })
    setPending(null)
    if (!outcome.sent) {
      if (outcome.field) {
        setProblems({ [outcome.field]: outcome.message })
        focusAfter.current = outcome.field
      } else {
        setError(outcome.message)
      }
      return
    }
    startWaiting(RESEND_SECONDS)
    setSentTo(checked.entry.email)
    setStep("code")
  }

  return (
    <section aria-labelledby="signup-title" className={cn("w-full max-w-md rounded-4xl border glass p-8 shadow-float", className)}>
      {step === "code" ? (
        <SignupCode email={sentTo} next={next} waiting={waiting} onSent={() => startWaiting(RESEND_SECONDS)} onBack={() => setStep("form")} />
      ) : (
        <>
          <h1 id="signup-title" className="font-heading text-3xl">
            Create an account
          </h1>
          <p className="mt-2 text-muted-foreground">Keep your games, your friends and your stats on every device.</p>

          {error && (
            <Alert variant="destructive" className="mt-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form ref={form} onSubmit={submit} noValidate className="mt-6 flex flex-col gap-4">
            <Field data-invalid={problems.email ? true : undefined}>
              <FieldLabel htmlFor="signup-email">E-mail</FieldLabel>
              <Input
                id="signup-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={fields.email}
                onChange={edit("email")}
                disabled={off}
                aria-invalid={problems.email ? true : undefined}
                aria-describedby={problems.email ? "signup-email-error" : undefined}
              />
              <FieldError id="signup-email-error">{problems.email}</FieldError>
            </Field>
            <Field data-invalid={problems.password ? true : undefined}>
              <FieldLabel htmlFor="signup-password">Password</FieldLabel>
              <PasswordInput
                id="signup-password"
                name="password"
                autoComplete="new-password"
                required
                value={fields.password}
                onChange={edit("password")}
                disabled={off}
                aria-invalid={problems.password ? true : undefined}
                aria-describedby={problems.password ? "signup-password-error signup-password-help" : "signup-password-help"}
              />
              <FieldDescription id="signup-password-help">At least {PASSWORD_MIN} characters.</FieldDescription>
              <FieldError id="signup-password-error">{problems.password}</FieldError>
            </Field>
            <Field data-invalid={problems.name ? true : undefined}>
              <FieldLabel htmlFor="signup-name">
                Display name <span className="text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Input
                id="signup-name"
                name="name"
                autoComplete="nickname"
                autoCapitalize="words"
                value={fields.name}
                onChange={edit("name")}
                disabled={off}
                aria-invalid={problems.name ? true : undefined}
                aria-describedby={problems.name ? "signup-name-error signup-name-help" : "signup-name-help"}
              />
              <FieldDescription id="signup-name-help">
                The name the other players see, {DISPLAY_NAME_MAX} characters at most. Without one, it is the start of your e-mail address.
              </FieldDescription>
              <FieldError id="signup-name-error">{problems.name}</FieldError>
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={off}>
              {pending === "signup" && <Spinner data-icon="inline-start" />}
              Create account
            </Button>
            <p className="text-xs text-muted-foreground">
              By creating an account you accept the{" "}
              <Link href="/legal/terms" className="underline underline-offset-4">
                Terms of Use
              </Link>{" "}
              and the{" "}
              <Link href="/legal/privacy" className="underline underline-offset-4">
                Privacy Policy
              </Link>
              . You must be 13 or older.
            </p>
          </form>

          <ProviderRow providers={providers} pending={pending} disabled={off} onSelect={start} />
          {!enabled && <p className="mt-4 text-sm text-muted-foreground">Creating an account is not available on this site yet.</p>}

          <p className="mt-6 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href={loginHref} className="text-foreground underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </>
      )}
    </section>
  )
}
