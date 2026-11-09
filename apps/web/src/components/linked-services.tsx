"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Mail01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { PROVIDERS, PROVIDER_NAMES, isExternalProvider, type LinkedService, type Provider } from "@pbgo/accounts"
import { linkProvider, unlinkProvider } from "@pbgo/accounts/client"
import { BrandMark } from "@pbgo/ui/brands"
import { Alert, AlertDescription } from "@pbgo/ui/platform/alert"
import { Button } from "@pbgo/ui/platform/button"
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@pbgo/ui/platform/item"
import { Spinner } from "@pbgo/ui/platform/spinner"
import { toast } from "@pbgo/ui/platform/sonner"
import { changing, failureOf } from "@/lib/settings-change"

/**
 * The ways into the account, one row each: the e-mail address and password when the account has them, the external providers it holds (Steam: a row with nothing to press, like the e-mail's), then every provider the project has switched on (`available`) or that the account holds already, each with its mark, what it says of itself
 * (its address or its name) and one button, Link or Unlink. Linking sends the member to the provider and back to this page (`linkProvider`), unlinking takes the identity off at once; the last way in cannot be unlinked, so its button is off. Both need
 * "Allow manual linking" in the Supabase project (`docs/accounts.md`): when it is off the member is told it is not available.
 */
export function LinkedServices({ linked, available, demo }: { linked: readonly LinkedService[]; available: readonly Provider[]; demo: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState<Provider | null>(null)
  const [error, setError] = useState<string | null>(null)
  const email = linked.find((service) => service.provider === "email")
  const external = linked.filter((service) => isExternalProvider(service.provider))
  // A way in can only be taken off while another is left
  const canUnlink = linked.length > 1
  const providers = PROVIDERS.filter((provider) => available.includes(provider) || linked.some((service) => service.provider === provider))

  async function toggle(provider: Provider, isLinked: boolean) {
    setPending(provider)
    setError(null)
    const outcome = await changing(demo, () => (isLinked ? unlinkProvider(provider) : linkProvider(provider)))
    const failure = failureOf(outcome)
    if (failure) {
      setPending(null)
      setError(failure)
      return
    }
    // Linking leaves for the provider: the page is gone before it gets here. Unlinking is done, and the page has to draw the list again
    setPending(null)
    if (isLinked) {
      toast.success(`${PROVIDER_NAMES[provider]} unlinked`)
      router.refresh()
    }
  }

  return (
    <>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {email && (
        <Item>
          <ItemMedia>
            <HugeiconsIcon icon={Mail01Icon} strokeWidth={2} className="size-5" aria-hidden="true" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>E-mail and password</ItemTitle>
            {email.detail && <ItemDescription className="ph-mask">{email.detail}</ItemDescription>}
          </ItemContent>
        </Item>
      )}
      {external.map((service) => (
        <Item key={service.provider}>
          <ItemMedia>
            <BrandMark brand={service.provider as Exclude<typeof service.provider, "email">} className="size-5" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{PROVIDER_NAMES[service.provider as Exclude<typeof service.provider, "email">]}</ItemTitle>
            {service.detail && <ItemDescription className="ph-mask">{service.detail}</ItemDescription>}
          </ItemContent>
        </Item>
      ))}
      {providers.map((provider) => {
        const service = linked.find((candidate) => candidate.provider === provider)
        const isLinked = service !== undefined
        return (
          <Item key={provider}>
            <ItemMedia>
              <BrandMark brand={provider} className="size-5" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{PROVIDER_NAMES[provider]}</ItemTitle>
              <ItemDescription className="ph-mask">{isLinked ? (service.detail ?? "Linked") : "Not linked"}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button
                variant="outline"
                disabled={pending !== null || (isLinked && !canUnlink)}
                title={isLinked && !canUnlink ? "You need at least one way to sign in" : undefined}
                onClick={() => toggle(provider, isLinked)}
              >
                {pending === provider && <Spinner />}
                {isLinked ? "Unlink" : "Link"}
              </Button>
            </ItemActions>
          </Item>
        )
      })}
    </>
  )
}
