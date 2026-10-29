import Link from "next/link"
import { Button } from "@pbgo/ui/platform/button"
import { PlanCard } from "@pbgo/ui/platform/plan-card"
import { euro, PLANS } from "@/lib/plans"

/**
 * The three plans in a row from `lg` (under it one column, the cards 28rem wide at the most and centred: three columns of a tablet are too narrow for a price and its period), the cards the same height. The free plan has the one live button, to the games; the paid ones are not on sale, and their button says so
 * and is disabled, since a click would have nowhere to go. The Pricing page and `/design` draw it.
 */
export function PricingPlans() {
  return (
    <div className="mx-auto grid w-full max-w-md gap-4 lg:max-w-none lg:grid-cols-3">
      {PLANS.map((plan) => (
        <PlanCard
          key={plan.id}
          name={plan.name}
          price={euro(plan.price)}
          period={plan.price > 0 ? "/ month" : undefined}
          description={plan.description}
          features={plan.features}
          action={
            plan.price === 0 ? (
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
  )
}
