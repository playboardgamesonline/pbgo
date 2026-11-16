import type { ReactNode } from "react"
import { cn } from "@pbgo/ui/utils"
import { ListPageHeader } from "@/components/list-page-header"

/**
 * The frame of the pages of an account: the page in a column that does not stretch with the window, under the navbar and with no footer (the pages of the signed-in space and the profiles have none). The friends are not drawn
 * here: the bar of the games they are in is the navbar's, on every page of the hub (`SiteFriends`), this one included. The bar is the hub layout's, which marks the tab of the member's own pages (Profile, Career) and no tab on a public
 * profile. A page that is a tab of the bar (the career) has a `title`, which is the head of the pages of the tabs (`ListPageHeader`, big and centred, higher than theirs and with more room under it, since what follows is dense) and stands in for the clearance under the bar; `wide` is wider than the others, but not
 * as wide as the hub's pages (its rows would stretch with a gap in the middle).
 */
export function AccountShell({ wide = false, title, children }: { wide?: boolean; title?: string; children: ReactNode }) {
  return (
    <main className={title ? undefined : "pt-navbar"}>
      {title && <ListPageHeader title={title} className="pt-8 md:pb-20" />}
      <div className={cn("mx-auto w-full px-gutter pb-section", wide ? "max-w-7xl" : "max-w-5xl", !title && "pt-section")}>{children}</div>
    </main>
  )
}
