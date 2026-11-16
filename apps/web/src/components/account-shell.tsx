import type { ReactNode } from "react"
import { cn } from "@pbgo/ui/utils"
import { ListPageHeader } from "@/components/list-page-header"

// The height of the head from `lg` (`--head`): the clearance under the bar (6.5rem), which the title starts at, its line (1.05 of the 4.5rem it has at the most) and 2.75rem under it. What sticks under the head sticks at `top-(--head)`.
const HEAD = "lg:[--head:14rem]"

/**
 * The frame of the pages of an account: the page in a column that does not stretch with the window, under the navbar and with no footer (the pages of the signed-in space and the profiles have none). The friends are not drawn
 * here: the bar of the games they are in is the navbar's, on every page of the hub (`SiteFriends`), this one included. The bar is the hub layout's, which marks the tab of the member's own pages (Profile, Career) and no tab on a public
 * profile. A page that is a tab of the bar (the career) has a `title`, which is the head of the pages of the tabs (`ListPageHeader`, big and centred, but a size smaller (the page title's size, kept under the scale's 7xl) and higher than theirs)
 * and stands in for the clearance under the bar. From `lg` that head is pinned under the bar and the page scrolls under it: it is `--head` tall, which is also where what sticks under it sticks (`top-(--head)`), and the room that the other pages
 * leave under their title is the margin of what follows (`lg:mt-9` of the career), which scrolls away, and the foot of the page is 3.5rem there, the room that what sticks keeps at the foot of the window too (a window lower than what sticks, the head and that foot is for what sticks to scroll inside, never for the end of the page to push it up under the head); `wide` is wider than the others, but not as wide as the hub's pages (its rows would stretch with a gap in the middle).
 */
export function AccountShell({ wide = false, title, children }: { wide?: boolean; title?: string; children: ReactNode }) {
  return (
    <main className={title ? HEAD : "pt-navbar"}>
      {title && (
        <div className="lg:sticky lg:top-0 lg:z-20 lg:h-(--head) lg:bg-background">
          <ListPageHeader title={title} className="pt-8 md:pb-20 lg:pt-0 lg:pb-11" titleClassName="text-[length:min(var(--text-page-title),var(--text-7xl))]" />
        </div>
      )}
      <div className={cn("mx-auto w-full px-gutter pb-section", wide ? "max-w-7xl" : "max-w-5xl", title ? "lg:pb-14" : "pt-section")}>{children}</div>
    </main>
  )
}
