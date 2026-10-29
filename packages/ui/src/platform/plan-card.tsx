import * as React from "react"
import { Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Card, CardContent, CardDescription, CardHeader } from "./card"
import { Separator } from "./separator"

// A plan of the Pricing page, in a `Card` like any container of the platform: its name, what it is for, its price, the button that takes it, then what it includes. The three plans of a page are drawn the same
// size and the same weight: none is pushed over the others, the page decides what each button does (a plan that is not on sale has a disabled one) and the card only draws what it is given. The price is
// the biggest thing on the card (Geist at 720, as the titles; `text-4xl`, and `text-5xl` from `xl` where a card is wide enough for it), with what it is for after it in the muted colour, which goes under it
// when the room runs out and is never cut in two; it is a text, so a screen reader reads "€0.99 / month". The name is the heading of the card, which is a labelled
// group, so that the list of what is included is read as the plan's own.

type PlanCardProps = Omit<React.ComponentProps<typeof Card>, "children"> & {
  /** The name of the plan: the title of the card. */
  name: string
  /** The price as it is written (`€0.99`). */
  price: string
  /** What the price is for, after it (`/ month`); a free plan has none. */
  period?: string
  /** What the plan is for, in one line. */
  description: string
  /** What the plan includes, one line each, a tick before it. */
  features: readonly string[]
  /** The button under the price: the page decides what it does, and a plan that is not on sale has a disabled one. It is as wide as the card (`className="w-full"`). */
  action: React.ReactNode
}

/** A plan: name, description, price, the button, a hairline, then the list of what it includes. The cards of a row stretch to the tallest. */
function PlanCard({ name, price, period, description, features, action, className, ...props }: PlanCardProps) {
  const titleId = React.useId()
  return (
    <Card data-slot="plan-card" role="group" aria-labelledby={titleId} className={className} {...props}>
      <CardHeader>
        <h2 id={titleId} className="font-heading text-lg">
          {name}
        </h2>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-6">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-strong text-4xl tracking-tight tabular-nums xl:text-5xl">{price}</span>
          {period && <span className="whitespace-nowrap text-muted-foreground">{period}</span>}
        </p>
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

export { PlanCard, type PlanCardProps }
