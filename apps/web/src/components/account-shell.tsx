import type { ReactNode } from "react"
import { SiteFooter } from "@/components/site-footer"

/**
 * The frame of the pages of an account: the page in a column that does not stretch with the window, between the navbar and the footer. The friends are not drawn
 * here: the bar of the games they are in is the navbar's, on every page of the hub (`SiteFriends`), this one included. The bar is the hub layout's, which marks no tab on
 * these pages.
 */
export function AccountShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col">
      <main className="flex-1 pt-navbar">
        <div className="mx-auto w-full max-w-5xl px-gutter pt-section pb-section">{children}</div>
      </main>
      <SiteFooter />
    </div>
  )
}
