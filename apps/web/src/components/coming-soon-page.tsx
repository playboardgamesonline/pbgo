import type { ReactNode } from "react"

import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@pbgo/ui/platform/empty"
import { ListPageHeader } from "@/components/list-page-header"
import { SiteFooter } from "@/components/site-footer"

/**
 * A page of the navbar that has nothing to list yet (Tables, Tournaments, Pricing): the head of the pages of the tabs (`ListPageHeader`: the title, big and centred, with the search bar of what the page is
 * to list under it, `search`; Pricing has none), and one empty state under it, where the list will be (the `results` that the search scrolls to), that says what is to come, with the way to
 * somewhere that has something when there is one (`action`), then the footer. The bar is the hub layout's, which marks the tab of the page. The home's sections lead here ("See all"), so the page has to hold
 * up for a visitor. The page that fills one in replaces this component with its own.
 */
export function ComingSoonPage({
  title,
  heading,
  description,
  action,
  search,
}: {
  /** The title of the page. */
  title: string
  /** What the empty state says, in a few words. */
  heading: string
  description: string
  action?: ReactNode
  /** The search bar of what the page is to list (`ListSearch`), when it is to list something. */
  search?: ReactNode
}) {
  return (
    <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col">
      <main className="flex-1">
        <ListPageHeader title={title}>{search}</ListPageHeader>
        <section id="results" aria-label={title} className="mx-auto w-full max-w-page scroll-mt-navbar px-gutter pt-10 pb-section">
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
