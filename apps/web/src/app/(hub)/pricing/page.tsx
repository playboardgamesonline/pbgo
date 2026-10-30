import type { Metadata } from "next"
import { Button } from "@pbgo/ui/platform/button"
import { ListPageHeader } from "@/components/list-page-header"
import { PricingPlans } from "@/components/pricing-plans"
import { SiteFooter } from "@/components/site-footer"
import { CONTACT } from "@/site"

// The plans are a first draft and nothing is on sale: the page stays out of the search engines until it is true
export const metadata: Metadata = { title: "Pricing", alternates: { canonical: "/pricing" }, robots: { index: false } }

/**
 * Pricing: the title of the tabs' pages, a line that says what a plan is for, the plans (`PricingPlans`: a selector between paying month by month and a year at once, then Free, Plus at 0.99 euros a month and Club at 3.99, the paid
 * ones faded and disabled), a line that says why no paid subscription is offered for now, a call to the publishers, then the footer. The contracts with the publishers are not said here (a fuller footer may one day).
 */
export default function PricingPage() {
  return (
    <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col">
      <main className="flex-1">
        <ListPageHeader title="Pricing" />
        <section aria-label="Plans" className="mx-auto flex w-full max-w-page flex-col gap-10 px-gutter pt-4 pb-section">
          <p className="mx-auto max-w-2xl text-center text-lg text-muted-foreground">
            Every game is free to play. A plan adds what goes around the games: expansions, tournaments, a voice room and your statistics.
          </p>
          <PricingPlans />
          <p className="text-center text-sm text-muted-foreground">Since the games are not licensed, no paid subscription is offered for now.</p>
          <aside aria-label="Publishers" className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
            <p className="text-lg text-muted-foreground">Are you a publisher? I would love to hear from you.</p>
            <Button asChild size="lg" variant="outline">
              <a href={`mailto:${CONTACT}?subject=Publisher%20enquiry`}>Get in touch</a>
            </Button>
          </aside>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
