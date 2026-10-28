import type { ReactNode } from "react"

import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@pbgo/ui/platform/empty"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader, type SiteTabId } from "@/components/site-header"

/**
 * A page of the navbar that has nothing to list yet (Tables, Tournaments, What's New): the bar with its tab current, the title, and one
 * empty state that says what is to come, with the way to somewhere that has something when there is one (`action`), then the footer. The home's
 * sections lead here ("See all"), so the page has to hold up for a visitor. The page that fills one in replaces this component with its own.
 */
export function ComingSoonPage({
  tab,
  title,
  heading,
  description,
  action,
}: {
  tab: SiteTabId
  /** The title of the page. */
  title: string
  /** What the empty state says, in a few words. */
  heading: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col">
      <SiteHeader current={tab} />
      <main className="flex-1 pt-navbar">
        <section className="mx-auto flex w-full max-w-page flex-col gap-8 px-gutter pt-section pb-section">
          <h1 className="font-heading text-4xl sm:text-5xl">{title}</h1>
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>{heading}</EmptyTitle>
              <EmptyDescription>{description}</EmptyDescription>
            </EmptyHeader>
            {action && <EmptyContent>{action}</EmptyContent>}
          </Empty>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
