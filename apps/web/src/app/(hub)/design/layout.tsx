import type { Metadata } from "next"
import Link from "next/link"
import { Badge } from "@pbgo/ui/platform/badge"
import { Logo } from "@pbgo/ui/platform/logo"
import { SITE_NAME } from "@/site"
import { PageNav } from "./_components/page-nav"

// Internal reference for the team and its agents: out of search results (noindex on every page of it, absent from the sitemap, which lists the hub and the indexable games only) and out of crawlers' way.
export const metadata: Metadata = { robots: { index: false, follow: false } }

/**
 * The shell of every page of `/design`: the header, and under it the side navigation (the pages by family, the sections of the one the visitor is on) next to the page. It is a layout, so that the navigation stays mounted from one
 * page to the next and keeps its scroll. On a narrow window the navigation folds into a `details`.
 */
export default function DesignLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-gutter">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" aria-label={SITE_NAME} className="flex shrink-0 items-center gap-2">
              <Logo className="h-6" />
              <span className="hidden sm:inline">{SITE_NAME}</span>
            </Link>
            <span className="text-muted-foreground">/</span>
            <Link href="/design" className="truncate">
              Design system
            </Link>
          </div>
          <Badge variant="outline">Internal · not indexed</Badge>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl gap-12 px-gutter">
        <aside className="sticky top-0 hidden h-svh w-56 shrink-0 overflow-y-auto pt-20 pb-8 lg:block">
          <PageNav />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-12 py-section">
          <details className="rounded-2xl border px-4 py-3 lg:hidden">
            <summary className="cursor-pointer">Pages and sections</summary>
            <div className="pt-4">
              <PageNav />
            </div>
          </details>
          {children}
        </main>
      </div>
    </div>
  )
}
