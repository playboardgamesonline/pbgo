import { notFound } from "next/navigation"
import { getSections } from "@pbgo/docs/server"
import { DocsHeader, DocsMenuDisclosure, DocsSidebar } from "@/components/docs-sidebar"

/**
 * The shell of every page of a doc (`/docs/<doc>/...`), the same for all of them and different from the hub's pages: the side menu stuck to the left edge of the window, whatever its width, with the logo and the name of the doc at its top,
 * a search of its pages and its pages in sections that fold, and the page next to it. The page is a column that stops at the width of the hub's pages (`max-w-page` between the `px-gutter` margins) and is centred in what the menu leaves; the
 * text of a page keeps its own measure and its tables, code and specimens take the width of the column.
 * It is a layout, so that the menu stays mounted from one page of the doc to the next and keeps its scroll. On a narrow window the menu folds into a `details` over the page. The pages are built when the site is: the files of `docs/` are read
 * then, by `@pbgo/docs`.
 */
export default async function DocLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ section: string }> }>) {
  const { section } = await params
  const doc = (await getSections()).find((candidate) => candidate.slug === section)
  if (!doc) notFound()
  return (
    <div className="flex min-h-svh">
      <aside className="sticky top-0 hidden h-svh w-72 shrink-0 flex-col gap-6 overflow-y-auto border-r p-4 lg:flex">
        <DocsHeader doc={doc} />
        <DocsSidebar doc={doc} />
      </aside>
      <main className="mx-auto flex w-full min-w-0 max-w-page flex-1 flex-col gap-12 px-gutter py-section">
        <div className="flex flex-col gap-4 lg:hidden">
          <DocsHeader doc={doc} />
          <DocsMenuDisclosure>
            <DocsSidebar doc={doc} />
          </DocsMenuDisclosure>
        </div>
        {children}
      </main>
    </div>
  )
}
