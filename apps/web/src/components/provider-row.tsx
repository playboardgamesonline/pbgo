"use client"

import { PROVIDERS, PROVIDER_NAMES, type Provider } from "@pbgo/accounts"
import { ProviderButton } from "@pbgo/ui/platform/provider-button"
import { Separator } from "@pbgo/ui/platform/separator"

/**
 * "or continue with" and one button per provider, side by side with nothing on them but the provider's small mark: the same under the sign-in's form and the sign-up's, since a provider's sign-in makes an account too. The
 * card controls it: it owns what is on its way (`pending`, a provider or its own form) and what a press does (`onSelect`), and while anything is on its way nothing else can be pressed (`disabled`). `providers` are the ones drawn.
 */
export function ProviderRow({
  providers = PROVIDERS,
  pending,
  disabled,
  onSelect,
}: {
  providers?: readonly Provider[]
  pending: string | null
  disabled: boolean
  onSelect: (provider: Provider) => void
}) {
  return (
    <>
      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <Separator className="flex-1" />
        or continue with
        <Separator className="flex-1" />
      </div>

      <div role="group" aria-label="Continue with" className="grid grid-cols-4 gap-3">
        {providers.map((provider) => (
          <ProviderButton key={provider} brand={provider} name={PROVIDER_NAMES[provider]} pending={pending === provider} disabled={disabled} onClick={() => onSelect(provider)} />
        ))}
      </div>
    </>
  )
}
