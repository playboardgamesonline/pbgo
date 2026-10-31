"use client"

import * as React from "react"
import Link from "next/link"
import { CrownIcon, DiceIcon, SparklesIcon } from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { Button } from "@pbgo/ui/platform/button"
import { PlanCard, PlanVisual } from "@pbgo/ui/platform/plan-card"
import { ToggleGroup, ToggleGroupItem } from "@pbgo/ui/platform/toggle-group"
import { ANNUAL_DISCOUNT, PLANS, priceOf, type Billing, type PlanId } from "@/lib/plans"

// A small picture above each name, for want of art: the die for what is free, sparkles for more, a crown for the club
const ICONS: Record<PlanId, IconSvgElement> = { free: DiceIcon, plus: SparklesIcon, club: CrownIcon }

/**
 * A selector between paying month by month and a year at once (a quarter less), then the three plans in a row from `lg` (under it one column, the cards 28rem wide at the most and centred: three columns of a tablet are too narrow
 * for a price and its period), the cards the same height. The selector changes what the cards say about their price, and nothing else moves. The free plan has the one live button, to the games; the paid ones cannot be taken (the
 * games are not licensed): they are faded, and their button says so and is disabled, since a click would have nowhere to go. The Pricing page and the docs of the design system draw it.
 */
export function PricingPlans() {
  const [billing, setBilling] = React.useState<Billing>("monthly")
  return (
    <div className="flex flex-col gap-8">
      {/* A second click on the chip that is on would turn it off: the value is then empty, and the choice stays */}
      <ToggleGroup type="single" value={billing} onValueChange={(value) => value && setBilling(value as Billing)} aria-label="Billing period" className="justify-center">
        <ToggleGroupItem value="monthly" className="h-10 px-5 text-base">
          Monthly
        </ToggleGroupItem>
        <ToggleGroupItem value="annually" className="h-10 px-5 text-base">
          Annually{" "}
          <span className="text-sm opacity-70">Save {Math.round(ANNUAL_DISCOUNT * 100)}%</span>
        </ToggleGroupItem>
      </ToggleGroup>
      <div className="mx-auto grid w-full max-w-md gap-4 lg:max-w-none lg:grid-cols-3">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            name={plan.name}
            {...priceOf(plan, billing)}
            description={plan.description}
            visual={<PlanVisual icon={ICONS[plan.id]} />}
            features={plan.features}
            disabled={!plan.onSale}
            action={
              plan.onSale ? (
                <Button asChild size="lg" className="w-full">
                  <Link href="/games">Start playing</Link>
                </Button>
              ) : (
                <Button size="lg" variant="outline" className="w-full" disabled>
                  Coming soon
                </Button>
              )
            }
          />
        ))}
      </div>
    </div>
  )
}
