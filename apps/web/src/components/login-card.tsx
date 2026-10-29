"use client"

import { useState } from "react"
import Link from "next/link"
import { DiscordIcon, GoogleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { PROVIDERS, PROVIDER_NAMES, type Provider } from "@pbgo/accounts"
import { signInWith } from "@pbgo/accounts/client"
import { Alert, AlertDescription } from "@pbgo/ui/platform/alert"
import { Button } from "@pbgo/ui/platform/button"
import { Spinner } from "@pbgo/ui/platform/spinner"
import { cn } from "@pbgo/ui/utils"

/** The mark of each provider, drawn in the colour of the text like every icon of the platform. */
const PROVIDER_ICONS = { google: GoogleIcon, discord: DiscordIcon } as const

/**
 * The sign-in: one button per provider, a card laid over the hub's backdrop. A press leaves for the provider, which sends the visitor back to
 * `/auth/callback` and on to `next`. Without a Supabase project (`enabled` is false) the buttons are off and say so, and `failed` is the page's way
 * to tell a visitor that a sign-in just did not work, which is all it ever says: why belongs to the logs, not to a stranger.
 */
export function LoginCard({ next, enabled, failed, className }: { next: string; enabled: boolean; failed: boolean; className?: string }) {
  const [pending, setPending] = useState<Provider | null>(null)
  const [error, setError] = useState<string | null>(failed ? "Sign-in did not work. Try again." : null)

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

  return (
    <section
      aria-labelledby="login-title"
      className={cn("w-full max-w-md rounded-3xl border bg-background/60 p-8 shadow-float backdrop-blur-xl", className)}
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

      <div className="mt-6 flex flex-col gap-3">
        {PROVIDERS.map((provider) => (
          <Button
            key={provider}
            type="button"
            variant="outline"
            size="lg"
            className="h-12 w-full justify-center text-base"
            disabled={!enabled || pending !== null}
            onClick={() => start(provider)}
          >
            {pending === provider ? <Spinner /> : <HugeiconsIcon icon={PROVIDER_ICONS[provider]} data-icon="inline-start" />}
            Continue with {PROVIDER_NAMES[provider]}
          </Button>
        ))}
      </div>
      {!enabled && <p className="mt-4 text-sm text-muted-foreground">Sign-in is not available on this site yet.</p>}

      <p className="mt-6 text-sm text-muted-foreground">
        No account needed to play: you can{" "}
        <Link href="/games" className="text-foreground underline underline-offset-4">
          pick a game
        </Link>{" "}
        as a guest.
      </p>
      <p className="mt-6 text-xs text-muted-foreground">
        By continuing you accept the{" "}
        <Link href="/terms" className="underline underline-offset-4">
          Terms of Use
        </Link>{" "}
        and the{" "}
        <Link href="/privacy" className="underline underline-offset-4">
          Privacy Policy
        </Link>
        .
      </p>
    </section>
  )
}
