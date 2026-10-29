import type { ReactNode } from "react"

import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@pbgo/ui/platform/empty"
import { ListPageHeader } from "@/components/list-page-header"
import { SiteFooter } from "@/components/site-footer"

/**
 * A page of the navbar that has nothing to list yet (Tables, Tournaments, What's New): the title, and one empty state that says what is to
 * come, with the way to somewhere that has something when there is one (`action`), then the footer. The bar is the hub layout's, which marks
 * the tab of the page. The home's sections lead here ("See all"), so the page has to hold up for a visitor. The page that fills one in replaces
 * this component with its own.
 * A page that is to have a list gives its search bar (`search`): it then has the head of the pages that list something (`ListPageHeader`: the title,
 * big and centred, with the search bar under it) and the empty state is where the list will be, the `results` that the search scrolls to. A page with no
 * search (What's New) keeps its small title, above the empty state.
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
  const empty = (
    <Empty className="border">
      <EmptyHeader>
        <EmptyTitle>{heading}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  )

  return (
    <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col">
      {search ? (
        <main className="flex-1">
          <ListPageHeader title={title}>{search}</ListPageHeader>
          <section id="results" aria-label={title} className="mx-auto w-full max-w-page scroll-mt-navbar px-gutter pt-10 pb-section">
            {empty}
          </section>
        </main>
      ) : (
        <main className="flex-1 pt-navbar">
          <section className="mx-auto flex w-full max-w-page flex-col gap-8 px-gutter pt-section pb-section">
            <h1 className="font-heading text-4xl sm:text-5xl">{title}</h1>
            {empty}
          </section>
        </main>
      )}
      <SiteFooter />
    </div>
  )
}
