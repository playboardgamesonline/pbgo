import { SiteFooter } from "@/components/site-footer"
import { SiteHeader, type SiteTabId } from "@/components/site-header"

/**
 * A page of the navbar with nothing on it yet (Tables, Tournaments, What's New): the bar with its tab current, a title that only screen
 * readers get, and the footer. The page that fills one in replaces this component with its own content.
 */
export function BlankPage({ tab, title }: { tab: SiteTabId; title: string }) {
  return (
    <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col">
      <SiteHeader current={tab} />
      <main className="flex-1 pt-navbar">
        <h1 className="sr-only">{title}</h1>
      </main>
      <SiteFooter />
    </div>
  )
}
