import type * as React from "react"
import { BrandMark, type BrandName } from "../brands"
import { cn } from "../utils"
import { Button } from "./button"
import { Spinner } from "./spinner"

/**
 * How the tile of each brand is dressed, in tokens: its fill, and the colour of the text, which its mark and a spinner take. Facebook and Discord are their
 * brand's colour (`brand-*`), Google is white (`foreground`) with its own four colours, and Apple is black (`background`) with an outline, which the dark page needs.
 */
const TILES: Record<BrandName, string> = {
  facebook: "border-transparent bg-brand-facebook text-foreground hover:bg-brand-facebook/90",
  google: "border-transparent bg-foreground text-background hover:bg-foreground/90 hover:text-background",
  apple: "border-input bg-background text-foreground hover:bg-muted",
  discord: "border-transparent bg-brand-discord text-foreground hover:bg-brand-discord/90",
}

/**
 * The button that signs a visitor in with a provider: a tile with nothing on it but the provider's small mark, wider than it is tall (`h-10`, and about twice that
 * in a row of four), so that several stand side by side in a row of equal cells. It says its name to a screen reader and in a tooltip, since the mark is all it draws.
 */
function ProviderButton({
  brand,
  name,
  pending = false,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "variant" | "size" | "asChild" | "children"> & {
  brand: BrandName
  /** The brand as a person says it, "Google": the button is named after it. */
  name: string
  /** A sign-in with this provider is on its way: the mark gives way to a spinner. */
  pending?: boolean
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      data-brand={brand}
      aria-label={`Continue with ${name}`}
      aria-busy={pending || undefined}
      title={`Continue with ${name}`}
      className={cn("h-10 w-full rounded-xl", TILES[brand], className)}
      {...props}
    >
      {pending ? <Spinner className="size-5" /> : <BrandMark brand={brand} className="size-5" />}
    </Button>
  )
}

export { ProviderButton }
