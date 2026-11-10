import type { Metadata } from "next"
import Link from "next/link"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { getSections } from "@pbgo/docs/server"
import { Card, CardDescription, CardHeader, CardTitle } from "@pbgo/ui/platform/card"
import { ListPageHeader } from "@/components/list-page-header"
import { SiteFooter } from "@/components/site-footer"
import { docIconOf } from "@/lib/doc-icons"

const DESCRIPTION = "The reference for how Play Board Games Online is designed and built: the look of its screens and the engines behind its games."

export const metadata: Metadata = { title: "Docs", description: DESCRIPTION, alternates: { canonical: "/docs" } }

/** A card of the hub: what a doc is, with its icon, its name and what it says of itself. The whole card is the link. */
function DocCard({ href, icon, title, description }: { href: string; icon: IconSvgElement; title: string; description?: string }) {
  return (
    <Link href={href} className="group/doc block h-full rounded-4xl outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
      <Card className="h-full transition-colors group-hover/doc:bg-secondary">
        <CardHeader>
          <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted">
            <HugeiconsIcon icon={icon} strokeWidth={2} className="size-6" aria-hidden="true" />
          </span>
          <CardTitle className="text-xl">{title}</CardTitle>
          {description && <CardDescription className="text-base">{description}</CardDescription>}
        </CardHeader>
      </Card>
    </Link>
  )
}

/**
 * The way into the docs, in the look of the pages of the navbar: the head they share (`ListPageHeader`, the title alone), then a card for each doc, with its icon, its name and its description, and the footer. There is
 * no list to keep here: a doc is a folder of `docs/` whose landing page says its icon and its description in its front matter, and a new folder is a new card. A card leads to the doc, which has a look of its own, a side menu next to its pages.
 * The first card is not a doc: it is the playground, an interface of its own at `/docs/playground`.
 */
export default async function DocsPage() {
  const docs = await getSections()
  return (
    <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col">
      <main className="flex-1">
        <ListPageHeader title="Docs" />
        <section aria-label="Docs" className="mx-auto w-full max-w-page px-gutter pb-section">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <li>
              <DocCard href="/docs/playground" icon={docIconOf("dice")} title="Playground" description="Every component of the table on one table, to move, tune and play with." />
            </li>
            {docs.map((doc) => (
              <li key={doc.slug}>
                <DocCard href={doc.href} icon={docIconOf(doc.icon)} title={doc.title} description={doc.description} />
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
