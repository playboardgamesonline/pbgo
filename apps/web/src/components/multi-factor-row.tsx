"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { MFA_MESSAGES, TOTP_LENGTH, formatSetupKey, isTotpCode, sinceLabel, type SecondStepDevice } from "@pbgo/accounts"
import { beginSecondStepSetup, cancelSecondStepSetup, finishSecondStepSetup, removeSecondStep, type SecondStepSetup } from "@pbgo/accounts/client"
import { Button } from "@pbgo/ui/platform/button"
import { Field, FieldLabel } from "@pbgo/ui/platform/field"
import { InputOTP, InputOTPGroup, InputOTPSlot, REGEXP_ONLY_DIGITS } from "@pbgo/ui/platform/input-otp"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@pbgo/ui/platform/item"
import { Spinner } from "@pbgo/ui/platform/spinner"
import { toast } from "@pbgo/ui/platform/sonner"
import { SettingsDialog } from "@/components/settings-dialog"
import { DEMO_SETUP } from "@/lib/demo-second-step"
import { changing, failureOf } from "@/lib/settings-change"
import { useCopied } from "@/lib/use-copied"
import { SITE_NAME } from "@/site"

/** Where the set-up window is: the factor is being made, it waits for the first code, or it could not be made (with the sentence to tell the member). */
type Setup = { status: "idle" } | { status: "starting" } | { status: "ready"; setup: SecondStepSetup } | { status: "failed"; message: string }

/** The six digits of a code from the app, in the field that both windows have: the sixth goes by itself (`onComplete`), the button is for whoever prefers to press it. */
function CodeField({
  id,
  value,
  invalid,
  disabled,
  inputRef,
  onChange,
  onComplete,
}: {
  id: string
  value: string
  invalid: boolean
  disabled: boolean
  inputRef: React.Ref<HTMLInputElement>
  onChange: (value: string) => void
  onComplete: (value: string) => void
}) {
  return (
    <Field data-invalid={invalid ? true : undefined}>
      <FieldLabel htmlFor={id}>Code from your app</FieldLabel>
      <InputOTP
        ref={inputRef}
        id={id}
        maxLength={TOTP_LENGTH}
        pattern={REGEXP_ONLY_DIGITS}
        value={value}
        onChange={onChange}
        onComplete={onComplete}
        disabled={disabled}
        aria-invalid={invalid ? true : undefined}
        containerClassName="w-full"
      >
        <InputOTPGroup className="w-full">
          {Array.from({ length: TOTP_LENGTH }, (_, index) => (
            <InputOTPSlot key={index} index={index} className="flex-1" />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </Field>
  )
}

/**
 * The Multi-factor authentication row of the settings (PLT-129): a code from an authenticator app, asked each time the member signs in, whichever way. Off, a button opens the window that sets it up: the QR code to scan, the setup key to type
 * into an app that cannot scan, which the member is told to keep (it gives their codes back if they lose their phone: the contact address is the way when they have not kept it) and the first code, which proves the app works. On, a button
 * opens the window that turns it off, which asks for a code too. Setting it up signs the member out of their other devices (Supabase Auth ends every session that has not passed the second step), so the window says so. The page draws this
 * row only for an account with an e-mail address to be checked by (`docs/accounts.md`). The QR code and the key are masked in recordings. The demo account of development holds no session: its windows are drawn with a made-up key and take any six digits.
 */
export function MultiFactorRow({ devices, demo }: { devices: readonly SecondStepDevice[]; demo: boolean }) {
  const router = useRouter()
  // What the member has just done, until the page, drawn again after the change (`router.refresh`), says it too: it is kept with the number of apps the page showed when it was done, so a page that has caught up wins. The demo account has no page
  // to catch up (it always shows none), so what was done stands
  const [done, setDone] = useState<{ on: boolean; seen: number } | null>(null)
  const on = done !== null && done.seen === devices.length ? done.on : devices.length > 0
  const since = sinceLabel(devices[0]?.createdAt)

  const [setupOpen, setSetupOpen] = useState(false)
  const [setup, setSetup] = useState<Setup>({ status: "idle" })
  const [offOpen, setOffOpen] = useState(false)
  const [code, setCode] = useState("")
  const [wrong, setWrong] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  // Which set-up is the current one: a window closed while its factor was being made must not be answered by it
  const attempt = useRef(0)
  const [copied, copy] = useCopied(setup.status === "ready" ? setup.setup.secret : undefined)

  // The field has the focus when a window is ready for the code and each time what was on its way is over (a wrong code)
  useEffect(() => {
    if ((setup.status === "ready" || offOpen) && !pending) input.current?.focus()
  }, [setup.status, offOpen, pending])

  function reset() {
    setCode("")
    setWrong(false)
    setError(null)
  }

  async function openSetup() {
    reset()
    const mine = ++attempt.current
    setSetup({ status: "starting" })
    setSetupOpen(true)
    const outcome = demo ? ({ status: "ready", setup: DEMO_SETUP } as const) : await beginSecondStepSetup(SITE_NAME)
    if (outcome.status === "ready" && attempt.current !== mine) {
      // The window was closed while the factor was being made: it is taken away again
      if (!demo) cancelSecondStepSetup(outcome.setup.factorId).catch(() => {})
      return
    }
    if (attempt.current !== mine) return
    setSetup(
      outcome.status === "ready"
        ? { status: "ready", setup: outcome.setup }
        : { status: "failed", message: outcome.status === "no-session" ? "You are signed out. Sign in again to make this change." : outcome.message },
    )
  }

  function closeSetup() {
    attempt.current++
    // A factor that was made and never proved is taken away: the Auth server would drop it by itself, a little later
    if (setup.status === "ready" && !demo) cancelSecondStepSetup(setup.setup.factorId).catch(() => {})
    setSetupOpen(false)
    setSetup({ status: "idle" })
    reset()
  }

  async function submitSetup(value = code) {
    if (setup.status !== "ready" || pending) return
    if (!isTotpCode(value)) {
      setError(MFA_MESSAGES["wrong-code"])
      setWrong(true)
      return
    }
    setPending(true)
    setError(null)
    const { factorId } = setup.setup
    const outcome = await changing(demo, () => finishSecondStepSetup(factorId, value))
    setPending(false)
    const failure = failureOf(outcome)
    if (failure) {
      setError(failure)
      setWrong(true)
      setCode("")
      return
    }
    attempt.current++
    setSetupOpen(false)
    setSetup({ status: "idle" })
    reset()
    setDone({ on: true, seen: devices.length })
    toast.success("Multi-factor authentication is on", { description: "You are signed out of your other devices." })
    if (!demo) router.refresh()
  }

  function openOff() {
    reset()
    setOffOpen(true)
  }

  async function submitOff(value = code) {
    if (pending) return
    if (!isTotpCode(value)) {
      setError(MFA_MESSAGES["wrong-code"])
      setWrong(true)
      return
    }
    setPending(true)
    setError(null)
    const outcome = await changing(demo, () => removeSecondStep(value))
    setPending(false)
    const failure = failureOf(outcome)
    if (failure) {
      setError(failure)
      setWrong(true)
      setCode("")
      return
    }
    setOffOpen(false)
    reset()
    setDone({ on: false, seen: devices.length })
    toast.success("Multi-factor authentication is off")
    if (!demo) router.refresh()
  }

  const ready = setup.status === "ready"
  return (
    <>
      <Item>
        <ItemContent>
          <ItemTitle>Multi-factor authentication</ItemTitle>
          <ItemDescription>
            {on
              ? `${since ? `On since ${since}. ` : "On. "}A code from your authenticator app is asked each time you sign in.`
              : "A code from an authenticator app, asked each time you sign in."}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          {on ? (
            <Button variant="outline" onClick={openOff}>
              Turn off
            </Button>
          ) : (
            <Button variant="outline" onClick={openSetup}>
              Set up
            </Button>
          )}
        </ItemActions>
      </Item>

      <SettingsDialog
        open={setupOpen}
        onOpenChange={(next) => !next && closeSetup()}
        title="Set up multi-factor authentication"
        description="Scan the QR code with an authenticator app, then enter the code it shows. Your other devices are signed out once it is on."
        submitLabel="Turn on"
        pending={pending}
        error={setup.status === "failed" ? setup.message : error}
        submitDisabled={!ready || code.length < TOTP_LENGTH}
        onSubmit={() => submitSetup()}
      >
        {setup.status === "starting" && (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        )}
        {setup.status === "ready" && (
          <>
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              {setup.setup.qr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={setup.setup.qr} alt="QR code to scan with your authenticator app" width={176} height={176} className="ph-no-capture size-44 shrink-0 rounded-2xl bg-foreground p-2" />
              )}
              <div className="flex min-w-0 flex-col gap-2">
                <p className="text-sm text-muted-foreground">{setup.setup.qr ? "Cannot scan it? Type this key into your app." : "Type this key into your app."}</p>
                <div className="flex items-center gap-2">
                  <code data-selectable className="ph-no-capture min-w-0 font-mono text-sm tracking-wider break-words">
                    {formatSetupKey(setup.setup.secret)}
                  </code>
                  <Button type="button" variant="outline" size="icon-sm" onClick={copy} aria-label={copied ? "Key copied" : "Copy the key"}>
                    <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} strokeWidth={2} aria-hidden="true" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">Keep this key in a password manager: it gives you your codes back if you lose your phone.</p>
              </div>
            </div>
            <CodeField
              id="multi-factor-setup-code"
              value={code}
              invalid={wrong}
              disabled={pending}
              inputRef={input}
              onChange={(value) => {
                setCode(value)
                setWrong(false)
              }}
              onComplete={(value) => submitSetup(value)}
            />
          </>
        )}
      </SettingsDialog>

      <SettingsDialog
        open={offOpen}
        onOpenChange={(next) => {
          setOffOpen(next)
          if (next) reset()
        }}
        title="Turn off multi-factor authentication"
        description="Your password, or the service you sign in with, will be all that protects your account. Enter a code from your app to confirm."
        submitLabel="Turn off"
        destructive
        pending={pending}
        error={error}
        submitDisabled={code.length < TOTP_LENGTH}
        onSubmit={() => submitOff()}
      >
        <CodeField
          id="multi-factor-off-code"
          value={code}
          invalid={wrong}
          disabled={pending}
          inputRef={input}
          onChange={(value) => {
            setCode(value)
            setWrong(false)
          }}
          onComplete={(value) => submitOff(value)}
        />
      </SettingsDialog>
    </>
  )
}
