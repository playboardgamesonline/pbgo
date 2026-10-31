import type { Metadata } from "next"
import Link from "next/link"
import { getSections } from "@pbgo/docs/server"
import { Badge } from "@pbgo/ui/platform/badge"
import { Logo } from "@pbgo/ui/platform/logo"
import { DocsMenuDisclosure, DocsNav } from "@/components/docs-nav"
import { SITE_NAME } from "@/site"

// Open to anyone with the link and out of the search engines (noindex on every page of it, absent from the sitemap, and no analytics: `isExcludedPath`): the docs are the team's and its agents' reference, and some of them
// name identifiers of the project's own services.
export const metadata: Metadata = { robots: { index: false, follow: false } }

/**
 * The shell of every page of `/docs`: the header, and under it the side menu (the sections of `docs/`, their groups and their pages, read from the disk, and the sections of the page the visitor is on) next to the page. It is as wide as the
 * hub's pages are (`max-w-page` between the `px-gutter` margins: the whole window up to 1536px), the text of a page keeps its own measure and its tables, code and specimens take the width that is left. It is a layout, so that the menu stays
 * mounted from one page to the next and keeps its scroll. On a narrow window the menu folds into a `details`. The pages are built when the site is: the files of `docs/` are read then, by `@pbgo/docs`.
 */
export default async function DocsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const sections = await getSections()
  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-page items-center justify-between gap-4 px-gutter">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" aria-label={SITE_NAME} className="flex shrink-0 items-center gap-2">
              <Logo className="h-6" />
              <span className="hidden sm:inline">{SITE_NAME}</span>
            </Link>
            <span className="text-muted-foreground">/</span>
            <Link href="/docs" className="truncate">
              Docs
            </Link>
          </div>
          <Badge variant="outline">Internal · not indexed</Badge>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-page gap-12 px-gutter">
        <aside className="sticky top-0 hidden h-svh w-64 shrink-0 overflow-y-auto pt-20 pb-8 lg:block">
          <DocsNav sections={sections} />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-12 py-section">
          <DocsMenuDisclosure>
            <DocsNav sections={sections} />
          </DocsMenuDisclosure>
          {children}
        </main>
      </div>
    </div>
  )
}
