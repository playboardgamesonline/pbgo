"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AFTER_SIGN_IN, CODE_LENGTH, safeNext } from "@pbgo/accounts"
import { resendSignupCode, verifySignupCode } from "@pbgo/accounts/client"
import { Alert, AlertDescription } from "@pbgo/ui/platform/alert"
import { Button } from "@pbgo/ui/platform/button"
import { InputOTP, InputOTPGroup, InputOTPSlot, REGEXP_ONLY_DIGITS } from "@pbgo/ui/platform/input-otp"
import { Spinner } from "@pbgo/ui/platform/spinner"

/**
 * The second step of the sign-up: the code of the e-mail. The visitor types its six digits (or the phone fills them in), and the sixth goes to Supabase Auth by itself; the button is for whoever prefers to press it. A code that works
 * confirms the address and signs the visitor in, and a whole page load takes them on to `next` (the cookies hold the session, so the proxy and the server see it). A code that does not is cleared, and the field is ready again. The
 * visitor can ask for another code once the minute is over (`waiting` counts it, and the card starts it each time an e-mail goes out), or go back and correct the address. The address is on the screen, so it is masked in recordings.
 */
export function SignupCode({ email, next, waiting, onSent, onBack }: { email: string; next: string; waiting: number; onSent: () => void; onBack: () => void }) {
  const [code, setCode] = useState("")
  const [wrong, setWrong] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState<"code" | "resend" | null>(null)
  const input = useRef<HTMLInputElement>(null)

  // The field has the focus when the step opens and each time what was on its way is over: a wrong code, a new one asked for
  useEffect(() => {
    if (pending === null) input.current?.focus()
  }, [pending])

  async function verify(value: string) {
    if (pending !== null || value.length < CODE_LENGTH) return
    setPending("code")
    setError(null)
    setNotice(null)
    const problem = await verifySignupCode(email, value)
    if (problem) {
      setPending(null)
      setError(problem)
      setWrong(true)
      setCode("")
      return
    }
    window.location.assign(safeNext(next))
  }

  async function resend() {
    setPending("resend")
    setError(null)
    setNotice(null)
    setWrong(false)
    const outcome = await resendSignupCode(email, next)
    setPending(null)
    if (outcome.status === "sent") {
      setNotice("A new code is on its way.")
      onSent()
      return
    }
    setError(outcome.message)
    // Told to wait: the minute starts again, there is no use asking before it is over
    if (outcome.status === "wait") onSent()
  }

  return (
    <>
      <h1 id="signup-title" className="font-heading text-3xl">
        Check your e-mail
      </h1>
      <p id="signup-code-help" className="mt-2 text-muted-foreground">
        We sent a {CODE_LENGTH}-digit code to <span className="ph-mask text-foreground">{email}</span>. Enter it below, or follow the link in the e-mail.
      </p>

      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert className="mt-6">
          <AlertDescription>{notice}</AlertDescription>
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
          id="signup-code"
          maxLength={CODE_LENGTH}
          pattern={REGEXP_ONLY_DIGITS}
          value={code}
          onChange={(value) => {
            setCode(value)
            setWrong(false)
          }}
          onComplete={verify}
          disabled={pending === "code"}
          aria-label="Confirmation code"
          aria-describedby="signup-code-help"
          aria-invalid={wrong ? true : undefined}
          containerClassName="w-full"
        >
          <InputOTPGroup className="w-full">
            {Array.from({ length: CODE_LENGTH }, (_, index) => (
              <InputOTPSlot key={index} index={index} className="flex-1" />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <Button type="submit" size="lg" className="w-full" disabled={code.length < CODE_LENGTH || pending !== null}>
          {pending === "code" && <Spinner data-icon="inline-start" />}
          Confirm
        </Button>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={pending !== null || waiting > 0} onClick={resend}>
          {pending === "resend" && <Spinner data-icon="inline-start" />}
          {waiting > 0 ? `Send a new code in ${waiting} s` : "Send a new code"}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={pending !== null} onClick={onBack}>
          Use another e-mail address
        </Button>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Nothing yet? Look in your spam folder. If you already have an account,{" "}
        <Link href={next === AFTER_SIGN_IN ? "/login" : `/login?next=${encodeURIComponent(next)}`} className="text-foreground underline underline-offset-4">
          sign in
        </Link>{" "}
        instead.
      </p>
    </>
  )
}
