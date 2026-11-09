"use client"

import { useEffect, useRef, useState } from "react"
import { TOTP_LENGTH, isTotpCode, safeNext } from "@pbgo/accounts"
import { verifySecondStep } from "@pbgo/accounts/client"
import { Alert, AlertDescription } from "@pbgo/ui/platform/alert"
import { Button } from "@pbgo/ui/platform/button"
import { InputOTP, InputOTPGroup, InputOTPSlot, REGEXP_ONLY_DIGITS } from "@pbgo/ui/platform/input-otp"
import { Spinner } from "@pbgo/ui/platform/spinner"
import { CONTACT, SITE_NAME } from "@/site"

/**
 * The second step of the sign-in (PLT-129), drawn by `/login` for a visitor who has signed in with a first factor (a password, Google, Discord, Steam, a link) and whose account asks for a second: the six digits of their authenticator app.
 * The sixth goes to Supabase Auth by itself, the button is for whoever prefers to press it. A code that works makes the session one that has passed both, and a whole page load takes the visitor on to `next` (the cookies hold the session,
 * so the proxy and the server see it). A code that does not is cleared and the field is ready again. Whoever has lost their device is told how to get in (the contact address: the owner checks the message comes from the address of the
 * account and turns the second step off), and can sign out, which is a form that posts to `/logout`: the session of the first factor lives on until it is ended, and nothing but a click may end it.
 */
export function MfaChallengeCard({ next }: { next: string }) {
  const [code, setCode] = useState("")
  const [wrong, setWrong] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [lost, setLost] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  // The field has the focus when the card opens and each time what was on its way is over: a wrong code
  useEffect(() => {
    if (!pending) input.current?.focus()
  }, [pending])

  async function verify(value: string) {
    if (pending || !isTotpCode(value)) return
    setPending(true)
    setError(null)
    const problem = await verifySecondStep(value)
    if (problem) {
      setPending(false)
      setError(problem)
      setWrong(true)
      setCode("")
      return
    }
    window.location.assign(safeNext(next))
  }

  return (
    <section aria-labelledby="mfa-title" className="w-full max-w-md rounded-4xl border glass p-8 shadow-float">
      <h1 id="mfa-title" className="font-heading text-3xl">
        Enter your code
      </h1>
      <p id="mfa-help" className="mt-2 text-muted-foreground">
        Open your authenticator app and enter the {TOTP_LENGTH}-digit code it shows for {SITE_NAME}.
      </p>

      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault()
          verify(code)
        }}
        className="mt-6 flex flex-col gap-4"
      >
        <InputOTP
          ref={input}
          id="mfa-code"
          maxLength={TOTP_LENGTH}
          pattern={REGEXP_ONLY_DIGITS}
          value={code}
          onChange={(value) => {
            setCode(value)
            setWrong(false)
          }}
          onComplete={verify}
          disabled={pending}
          aria-label="Code from your authenticator app"
          aria-describedby="mfa-help"
          aria-invalid={wrong ? true : undefined}
          containerClassName="w-full"
        >
          <InputOTPGroup className="w-full">
            {Array.from({ length: TOTP_LENGTH }, (_, index) => (
              <InputOTPSlot key={index} index={index} className="flex-1" />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <Button type="submit" size="lg" className="w-full" disabled={!isTotpCode(code) || pending}>
          {pending && <Spinner data-icon="inline-start" />}
          Confirm
        </Button>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" aria-expanded={lost} aria-controls="mfa-lost" onClick={() => setLost((current) => !current)}>
          I lost my device
        </Button>
        <form action="/logout" method="post">
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </div>
      {lost && (
        <p id="mfa-lost" className="mt-4 text-sm text-muted-foreground">
          Write to{" "}
          <a className="text-foreground underline underline-offset-4" href={`mailto:${CONTACT}?subject=${encodeURIComponent("I lost my authenticator app")}`}>
            {CONTACT}
          </a>{" "}
          from the e-mail address of your account. We check that it is you and turn the second step off, and you can sign in again.
        </p>
      )}
    </section>
  )
}
