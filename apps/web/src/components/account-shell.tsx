import type { ReactNode } from "react"
import { cn } from "@pbgo/ui/utils"

/**
 * The frame of the pages of an account: the page in a column that does not stretch with the window, under the navbar and with no footer (the pages of the signed-in space and the profiles have none). The friends are not drawn
 * here: the bar of the games they are in is the navbar's, on every page of the hub (`SiteFriends`), this one included. The bar is the hub layout's, which marks the tab of the member's own pages (Profile, Career) and no tab on a public
 * profile. A page with no head of its own (`wide`: the career) is wider than the others, but not as wide as the hub's pages (its rows would stretch with a gap in the middle), and starts close under the bar.
 */
export function AccountShell({ wide = false, children }: { wide?: boolean; children: ReactNode }) {
  return (
    <main className="pt-navbar">
      <div className={cn("mx-auto w-full px-gutter pb-section", wide ? "max-w-7xl pt-8" : "max-w-5xl pt-section")}>{children}</div>
    </main>
  )
}
