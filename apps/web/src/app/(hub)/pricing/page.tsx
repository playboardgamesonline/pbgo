import type { Metadata } from "next"
import { ListPageHeader } from "@/components/list-page-header"
import { PricingPlans } from "@/components/pricing-plans"
import { SiteFooter } from "@/components/site-footer"

// The plans are a first draft and nothing is on sale: the page stays out of the search engines until it is true
export const metadata: Metadata = { title: "Pricing", alternates: { canonical: "/pricing" }, robots: { index: false } }

/**
 * Pricing: the title of the tabs' pages, a line that says what a plan is for, and the three plans (`PricingPlans`: Free, Plus at 0.99 euros a month and Club at 3.99), then the footer.
 * The plans are not on sale yet: the paid ones have a disabled button that says so, and the sentence under them says it again.
 */
export default function PricingPage() {
  return (
    <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col">
      <main className="flex-1">
        <ListPageHeader title="Pricing" />
        <section aria-label="Plans" className="mx-auto flex w-full max-w-page flex-col gap-10 px-gutter pt-4 pb-section">
          <p className="mx-auto max-w-2xl text-center text-lg text-muted-foreground">
            Every game is free to play. A plan adds things around the games: your history, your look, your tournaments.
          </p>
          <PricingPlans />
          <p className="text-center text-sm text-muted-foreground">Prices are per month, in euros. The paid plans are not on sale yet.</p>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
