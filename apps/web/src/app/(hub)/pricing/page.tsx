import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ListPageHeader } from "@/components/list-page-header"
import { PricingPlans } from "@/components/pricing-plans"
import { PublisherCall } from "@/components/publisher-call"
import { SiteFooter } from "@/components/site-footer"
import { PAID_PLANS_NOTICE } from "@/lib/plans"
import { PRICING_OPEN } from "@/site"

// The plans are a first draft and nothing is on sale: the page stays out of the search engines until it is true
export const metadata: Metadata = { title: "Pricing", alternates: { canonical: "/pricing" }, robots: { index: false } }

/**
 * Pricing: the title of the tabs' pages, a line that says what a plan is for, the plans (`PricingPlans`: a selector between paying month by month and a year at once, then Free, Plus at 0.99 euros a month and Club at 3.99, the paid
 * ones faded and disabled), a line that says why no paid subscription is offered for now, a call to the publishers (`PublisherCall`), then the footer. The contracts with the publishers are not said here (a fuller footer may one day).
 * There is no pricing to show for now, so the page is hidden: it answers 404 while `PRICING_OPEN` is false (`apps/web/src/site.ts`), and nothing else links to it.
 */
export default function PricingPage() {
  if (!PRICING_OPEN) notFound()

  return (
    <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col">
      <main className="flex-1">
        <ListPageHeader title="Pricing" />
        <section aria-label="Plans" className="mx-auto flex w-full max-w-page flex-col gap-10 px-gutter pt-4 pb-section">
          <p className="mx-auto max-w-2xl text-center text-lg text-muted-foreground">
            Every game is free to play. A plan adds what goes around the games: expansions, tournaments, a voice room and your statistics.
          </p>
          <PricingPlans />
          <p className="text-center text-sm text-muted-foreground">{PAID_PLANS_NOTICE}</p>
          <PublisherCall />
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
