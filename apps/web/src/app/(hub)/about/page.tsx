import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@pbgo/ui/platform/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@pbgo/ui/platform/empty"
import { ListPageHeader } from "@/components/list-page-header"
import { SiteFooter } from "@/components/site-footer"
import { COMING_SOON } from "@/lib/coming-soon"

// The text is not written yet, and the page says so: it stays out of the search engines until it has something to say
export const metadata: Metadata = { title: "About", alternates: { canonical: "/about" }, robots: { index: false } }

/**
 * About: what the site is and who makes it, then, in a section of the page (`#whats-new`), what is new: the new games and the notes of each release. What's New was a page of its own, `/whats-new`, which now
 * leads here (`next.config.ts`), and the home's section of the same name leads here too. Neither part has anything to say yet, so each is an empty state that says what is to come; the page that fills one in
 * replaces it.
 */
export default function AboutPage() {
  return (
    <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col">
      <main className="flex-1">
        <ListPageHeader title="About" />
        <section aria-label="About the site" className="mx-auto w-full max-w-page px-gutter pt-10 pb-section">
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>{COMING_SOON.about.heading}</EmptyTitle>
              <EmptyDescription>{COMING_SOON.about.description}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild variant="outline">
                <Link href="/games">Pick a game</Link>
              </Button>
            </EmptyContent>
          </Empty>
        </section>
        <section id="whats-new" aria-labelledby="whats-new-title" className="mx-auto flex w-full max-w-page scroll-mt-navbar flex-col gap-6 px-gutter pb-section">
          <h2 id="whats-new-title" className="font-heading text-3xl">
            What&apos;s new
          </h2>
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>{COMING_SOON.whatsNew.heading}</EmptyTitle>
              <EmptyDescription>{COMING_SOON.whatsNew.description}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
