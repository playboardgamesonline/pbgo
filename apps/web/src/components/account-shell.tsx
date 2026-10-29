import type { ReactNode } from "react"
import type { Friend } from "@pbgo/ui/platform/friends-panel"
import { FriendsSidebar } from "@/components/friends-sheet"
import { SiteFooter } from "@/components/site-footer"

/**
 * The frame of the pages of an account: the page on the left, and the friends in a panel on the right that stays in view while the page scrolls (it is
 * `sticky`, as high as the window less the navbar and the room of the consent banner). A screen without room for the panel (under `lg`) does not draw it: the profile's header has a button
 * for it, which opens the same panel in a sheet. The bar is the hub layout's, which marks no tab on these pages.
 */
export function AccountShell({ friends, preview, children }: { friends: readonly Friend[]; preview: boolean; children: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col">
      <main className="flex-1 pt-navbar">
        <div className="mx-auto flex w-full max-w-page items-start gap-10 px-gutter pt-section pb-section">
          <div className="min-w-0 flex-1">{children}</div>
          <aside className="sticky top-[calc(var(--spacing-navbar)+1.5rem)] hidden h-[calc(100svh-var(--consent-h,0px)-var(--spacing-navbar)-3rem)] w-80 shrink-0 lg:block xl:w-96">
            <FriendsSidebar friends={friends} preview={preview} />
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
