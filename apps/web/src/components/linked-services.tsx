"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { CheckmarkBadge01Icon, Mail01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CONNECTION_PROVIDERS,
  PROVIDER_NAMES,
  SIGN_IN_PROVIDERS,
  canUnlink,
  isExternalProvider,
  linkNoticeOf,
  type AnyProvider,
  type ExternalProvider,
  type LinkedService,
  type Provider,
} from "@pbgo/accounts"
import { linkExternal, linkProvider, unlinkExternal, unlinkProvider } from "@pbgo/accounts/client"
import { BrandMark } from "@pbgo/ui/brands"
import { Alert, AlertDescription } from "@pbgo/ui/platform/alert"
import { Button } from "@pbgo/ui/platform/button"
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@pbgo/ui/platform/item"
import { Spinner } from "@pbgo/ui/platform/spinner"
import { toast } from "@pbgo/ui/platform/sonner"
import { changing, failureOf } from "@/lib/settings-change"

/** The name of a service and, when the account holds it, the blue check right beside it: the one place that says a service is linked, for every row of the lists. */
export function ServiceName({ name, linked }: { name: string; linked: boolean }) {
  return (
    <span className="flex items-center gap-1">
      {name}
      {linked && <HugeiconsIcon icon={CheckmarkBadge01Icon} strokeWidth={2} role="img" aria-label="Linked" className="size-4 shrink-0 text-verified" />}
    </span>
  )
}

/**
 * Link or unlink one service: what the button of a row does. Linking leaves for the service and comes back to this page (Supabase's providers: `linkProvider`; Steam, which the hub signs in to itself: `linkExternal`), unlinking
 * takes the service off at once (`unlinkProvider`, `unlinkExternal`) and the page is drawn again. The demo account holds no session, so its changes are shown as done and nothing is asked. `error` is what the member was last told.
 */
function useServiceToggle(demo: boolean, told: string | null) {
  const router = useRouter()
  const [pending, setPending] = useState<AnyProvider | null>(null)
  const [error, setError] = useState<string | null>(told)

  async function toggle(provider: AnyProvider, isLinked: boolean) {
    setPending(provider)
    setError(null)
    const run = isExternalProvider(provider)
      ? () => (isLinked ? unlinkExternal(provider) : linkExternal(provider))
      : () => (isLinked ? unlinkProvider(provider) : linkProvider(provider))
    const failure = failureOf(await changing(demo, run))
    setPending(null)
    if (failure) {
      setError(failure)
      return
    }
    // Linking leaves for the service: the page is gone before it gets here. Unlinking is done, and the page has to draw the list again
    if (isLinked) {
      toast.success(`${PROVIDER_NAMES[provider]} unlinked`)
      router.refresh()
    }
  }

  return { pending, error, toggle }
}

/** One service of the account, with its mark, what it says of itself (its address or its name) and one button, Link or Unlink; the button is off when it is the last way in, and says why. */
function ServiceRow({
  provider,
  service,
  pending,
  leavable,
  onToggle,
}: {
  provider: AnyProvider
  service: LinkedService | undefined
  pending: AnyProvider | null
  leavable: boolean
  onToggle: (provider: AnyProvider, isLinked: boolean) => void
}) {
  const isLinked = service !== undefined
  return (
    <Item>
      <ItemMedia>
        <BrandMark brand={provider} className="size-5" />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          <ServiceName name={PROVIDER_NAMES[provider]} linked={isLinked} />
        </ItemTitle>
        <ItemDescription className="ph-mask">{isLinked ? (service.detail ?? "Linked") : "Not linked"}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button
          variant="outline"
          disabled={pending !== null || (isLinked && !leavable)}
          title={isLinked && !leavable ? "You need at least one way to sign in" : undefined}
          onClick={() => onToggle(provider, isLinked)}
        >
          {pending === provider && <Spinner />}
          {isLinked ? "Unlink" : "Link"}
        </Button>
      </ItemActions>
    </Item>
  )
}

/**
 * The ways into the account, one row each: the e-mail address and password when the account has them (a row with nothing to press), then Google, Discord and Steam, each when the project (or, for Steam, the server) has it
 * switched on (`available`, `externalAvailable`) or the account holds it already, with its mark, what it says of itself and Link or Unlink. Twitch is not here: it signs nobody in (`Connections`). The last way in cannot be
 * unlinked, so its button is off (`canUnlink`: the connections do not count). Linking and unlinking a provider of Supabase Auth need "Allow manual linking" in the project (`docs/accounts.md`): when it is off the member is told
 * it is not available; Steam needs nothing of the project. `notice` is the `?steam=` that the way back of a Steam link adds to the page (`linkNoticeOf`): it is told once, and the address is cleaned of it.
 */
export function SignInMethods({
  linked,
  available,
  externalAvailable,
  demo,
  notice,
}: {
  linked: readonly LinkedService[]
  available: readonly Provider[]
  externalAvailable: readonly ExternalProvider[]
  demo: boolean
  notice?: string | null
}) {
  const told = linkNoticeOf(notice)
  const { pending, error, toggle } = useServiceToggle(demo, told && !told.done ? told.message : null)
  const email = linked.find((service) => service.provider === "email")
  const rows = SIGN_IN_PROVIDERS.filter(
    (provider) => linked.some((service) => service.provider === provider) || (isExternalProvider(provider) ? externalAvailable.includes(provider) : available.includes(provider as Provider)),
  )

  // Said once: not twice when development runs the effect twice, and not again for a page that is drawn again or shared (the address is cleaned of the notice)
  const announced = useRef(false)
  useEffect(() => {
    const said = linkNoticeOf(notice)
    if (!said || announced.current) return
    announced.current = true
    if (said.done) toast.success("Steam linked")
    window.history.replaceState(null, "", window.location.pathname)
  }, [notice])

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
            <ItemTitle>
              <ServiceName name="E-mail and password" linked />
            </ItemTitle>
            {email.detail && <ItemDescription className="ph-mask">{email.detail}</ItemDescription>}
          </ItemContent>
        </Item>
      )}
      {rows.map((provider) => {
        const service = linked.find((candidate) => candidate.provider === provider)
        return <ServiceRow key={provider} provider={provider} service={service} pending={pending} leavable={canUnlink(linked, provider)} onToggle={toggle} />
      })}
    </>
  )
}

/**
 * The connections of the account: the services that are linked to it for the member's profile and never let anybody in (`CONNECTION_PROVIDERS`: Twitch). Each has its mark, what it says of itself and Link or Unlink, which
 * works as a provider's of Supabase Auth (`linkProvider`). It does not count among the ways in: unlinking it never leaves the account without one, and linking it adds none.
 */
export function Connections({ linked, available, demo }: { linked: readonly LinkedService[]; available: readonly Provider[]; demo: boolean }) {
  const { pending, error, toggle } = useServiceToggle(demo, null)
  const rows = CONNECTION_PROVIDERS.filter((provider) => linked.some((service) => service.provider === provider) || available.includes(provider as Provider))

  return (
    <>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {rows.map((provider) => {
        const service = linked.find((candidate) => candidate.provider === provider)
        return <ServiceRow key={provider} provider={provider} service={service} pending={pending} leavable={canUnlink(linked, provider)} onToggle={toggle} />
      })}
    </>
  )
}
