import * as React from "react"
import { Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { cn } from "../utils"
import { Card, CardContent, CardDescription, CardHeader } from "./card"
import { Separator } from "./separator"

// A plan of the Pricing page, in a `Card` like any container of the platform: a small picture, its name, what it is for, its price, the button that takes it, then what it includes. The three plans of a page are drawn the same
// size and the same weight: none is pushed over the others, the page decides what each button does (a plan that is not on sale has a disabled one) and the card only draws what it is given. The price is
// the biggest thing on the card (Geist at 720, as the titles; `text-4xl`, and `text-5xl` from `xl` where a card is wide enough for it), with what it is for after it in the muted colour, which goes under it
// when the room runs out and is never cut in two, and how it is billed under that; it is a text, so a screen reader reads "€0.99 / month". The name is the heading of the card, which is a labelled
// group, so that the list of what is included is read as the plan's own. A plan that cannot be taken is half transparent: visible, and told so to assistive technology (`aria-disabled`, which a group has).

type PlanCardProps = Omit<React.ComponentProps<typeof Card>, "children"> & {
  /** The name of the plan: the title of the card. */
  name: string
  /** The price as it is written (`€0.99`). */
  price: string
  /** What the price is for, after it (`/ month`); a free plan has none. */
  period?: string
  /** How the price is billed, under it (`Billed monthly`). The three cards of a row all have one, so that their buttons stay level. */
  note?: string
  /** What the plan is for, in one line. */
  description: string
  /** A picture above the name, which only decorates (a screen reader skips it): `PlanVisual`, or any art of the same size. */
  visual?: React.ReactNode
  /** What the plan includes, one line each, a tick before it. */
  features: readonly string[]
  /** The button under the price: the page decides what it does, and a plan that is not on sale has a disabled one. It is as wide as the card (`className="w-full"`). */
  action: React.ReactNode
  /** A plan that cannot be taken: half transparent, and `aria-disabled`. The button is the page's, and is disabled by it. */
  disabled?: boolean
}

/** A plan: picture, name, description, price, how it is billed, the button, a hairline, then the list of what it includes. The cards of a row stretch to the tallest. */
function PlanCard({ name, price, period, note, description, visual, features, action, disabled, className, ...props }: PlanCardProps) {
  const titleId = React.useId()
  return (
    <Card
      data-slot="plan-card"
      role="group"
      aria-labelledby={titleId}
      aria-disabled={disabled || undefined}
      className={cn(disabled && "opacity-50", className)}
      {...props}
    >
      <CardHeader>
        {visual && (
          <div data-slot="plan-card-visual" aria-hidden="true" className="mb-3">
            {visual}
          </div>
        )}
        <h2 id={titleId} className="font-heading text-lg">
          {name}
        </h2>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-6">
        <div className="flex flex-col gap-1">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-strong text-4xl tracking-tight tabular-nums xl:text-5xl">{price}</span>
            {period && <span className="whitespace-nowrap text-muted-foreground">{period}</span>}
          </p>
          {note && <p className="text-sm text-muted-foreground">{note}</p>}
        </div>
        {action}
        <Separator />
        <ul className="flex flex-col gap-3">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5">
              <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-foreground" />
              {feature}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

/** A picture for a plan, for want of art: an icon on a square of the muted tint, with the corners of a control. A plan's own picture (a render, like the title's coin and die) takes its place in `visual`, at 3rem. */
function PlanVisual({ icon, className, ...props }: Omit<React.ComponentProps<"span">, "children"> & { icon: IconSvgElement }) {
  return (
    <span data-slot="plan-visual" className={cn("flex size-12 items-center justify-center rounded-xl bg-muted text-foreground", className)} {...props}>
      <HugeiconsIcon icon={icon} strokeWidth={1.5} aria-hidden="true" className="size-6" />
    </span>
  )
}

export { PlanCard, PlanVisual, type PlanCardProps }
