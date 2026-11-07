"use client"

import { PROVIDER_NAMES, type Provider } from "@pbgo/accounts"
import { ProviderButton } from "@pbgo/ui/platform/provider-button"
import { Separator } from "@pbgo/ui/platform/separator"
import { cn } from "@pbgo/ui/utils"

/** The columns of the row, one cell each: a lone provider is a wide tile and four are the row the design draws. Written out in full so that Tailwind finds the classes. */
const COLUMNS = ["grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4"] as const

/**
 * "or continue with" and one button per provider, side by side with nothing on them but the provider's small mark: the same under the sign-in's form and the sign-up's, since a provider's sign-in makes an account too. `providers` are the ones
 * the project has switched on (`enabledProviders`), in a row of as many columns, and none is drawn, not even the line, when there are none. The card controls the rest: it owns what is on its way (`pending`, a provider or its own form)
 * and what a press does (`onSelect`), and while anything is on its way nothing else can be pressed (`disabled`).
 */
export function ProviderRow({
  providers,
  pending,
  disabled,
  onSelect,
}: {
  providers: readonly Provider[]
  pending: string | null
  disabled: boolean
  onSelect: (provider: Provider) => void
}) {
  if (providers.length === 0) return null

  return (
    <>
      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <Separator className="flex-1" />
        or continue with
        <Separator className="flex-1" />
      </div>

      <div role="group" aria-label="Continue with" className={cn("grid gap-3", COLUMNS[Math.min(providers.length, COLUMNS.length) - 1])}>
        {providers.map((provider) => (
          <ProviderButton key={provider} brand={provider} name={PROVIDER_NAMES[provider]} pending={pending === provider} disabled={disabled} onClick={() => onSelect(provider)} />
        ))}
      </div>
    </>
  )
}
