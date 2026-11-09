"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { AFTER_SIGN_IN, safeNext, type AnyProvider } from "@pbgo/accounts"
import { secondStepNeeded, signInWith, signInWithPassword } from "@pbgo/accounts/client"
import { Alert, AlertDescription } from "@pbgo/ui/platform/alert"
import { Button } from "@pbgo/ui/platform/button"
import { Input } from "@pbgo/ui/platform/input"
import { Label } from "@pbgo/ui/platform/label"
import { Spinner } from "@pbgo/ui/platform/spinner"
import { cn } from "@pbgo/ui/utils"
import { ProviderRow } from "@/components/provider-row"

/**
 * The sign-in, a card laid over the hub's backdrop: a username and a password, then, under "or continue with", one button per provider that the project has switched on
 * (`providers`), side by side with nothing on them but the provider's small mark. A press on a provider leaves for it, and it sends the visitor back to `/auth/callback` and on to `next`; the
 * password signs in on the spot and a whole page load takes the visitor on to `next` (the cookies hold the session, so the proxy and the server see it), or, for a member whose account asks for a second step, to this page again, which asks for the code. Without a
 * Supabase project (`enabled` is false) everything is off and says so, and `failed` is the page's way to tell a visitor that a sign-in just did not work, which is
 * all it ever says: why belongs to the logs, not to a stranger.
 */
export function LoginCard({
  next,
  enabled,
  providers,
  failed,
  className,
}: {
  next: string
  enabled: boolean
  providers: AnyProvider[]
  failed: boolean
  className?: string
}) {
  // What is on its way: the password, or a provider. While it is, nothing else can be pressed
  const [pending, setPending] = useState<AnyProvider | "password" | null>(null)
  const [error, setError] = useState<string | null>(failed ? "Sign-in did not work. Try again." : null)
  const off = !enabled || pending !== null

  async function start(provider: AnyProvider) {
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
    const form = new FormData(event.currentTarget)
    setPending("password")
    setError(null)
    const problem = await signInWithPassword(String(form.get("username") ?? ""), String(form.get("password") ?? ""))
    if (problem) {
      setPending(null)
      setError(problem)
      return
    }
    // A member who set up the second step (PLT-129) has it left to pass: the sign-in page, drawn again, knows the session now and asks for the code, then takes them on to `next`
    const target = safeNext(next)
    window.location.assign((await secondStepNeeded()) ? `/login?next=${encodeURIComponent(target)}` : target)
  }

  return (
    <section
      aria-labelledby="login-title"
      className={cn("w-full max-w-md rounded-4xl border glass p-8 shadow-float", className)}
    >
      <h1 id="login-title" className="font-heading text-3xl">
        Sign in
      </h1>
      <p className="mt-2 text-muted-foreground">Keep your games, your friends and your stats on every device.</p>

      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="login-username">Username or e-mail</Label>
          <Input id="login-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required disabled={off} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="login-password">Password</Label>
          <Input id="login-password" name="password" type="password" autoComplete="current-password" required disabled={off} />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={off}>
          {pending === "password" && <Spinner data-icon="inline-start" />}
          Sign in
        </Button>
      </form>

      <ProviderRow providers={providers} pending={pending} disabled={off} onSelect={start} />
      {!enabled && <p className="mt-4 text-sm text-muted-foreground">Sign-in is not available on this site yet.</p>}

      <p className="mt-6 text-sm text-muted-foreground">
        New here?{" "}
        <Link href={next === AFTER_SIGN_IN ? "/signup" : `/signup?next=${encodeURIComponent(next)}`} className="text-foreground underline underline-offset-4">
          Create an account
        </Link>
        .
      </p>

      <p className="mt-6 text-xs text-muted-foreground">
        By continuing you accept the{" "}
        <Link href="/legal/terms" className="underline underline-offset-4">
          Terms of Use
        </Link>{" "}
        and the{" "}
        <Link href="/legal/privacy" className="underline underline-offset-4">
          Privacy Policy
        </Link>
        .
      </p>
    </section>
  )
}
