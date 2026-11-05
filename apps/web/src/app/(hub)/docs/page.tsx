import type { Metadata } from "next"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { getSections } from "@pbgo/docs/server"
import { Card, CardDescription, CardHeader, CardTitle } from "@pbgo/ui/platform/card"
import { ListPageHeader } from "@/components/list-page-header"
import { SiteFooter } from "@/components/site-footer"
import { docIconOf } from "@/lib/doc-icons"

const DESCRIPTION = "The reference for how Play Board Games Online is designed and built: the look of its screens and the engines behind its games."

export const metadata: Metadata = { title: "Docs", description: DESCRIPTION, alternates: { canonical: "/docs" } }

/**
 * The way into the docs, in the look of the pages of the navbar: the head they share (`ListPageHeader`, the title and a few words under it), then a card for each doc, with its icon, its name and its description, and the footer. There is
 * no list to keep here: a doc is a folder of `docs/` whose landing page says its icon and its description in its front matter, and a new folder is a new card. A card leads to the doc, which has a look of its own, a side menu next to its pages.
 */
export default async function DocsPage() {
  const docs = await getSections()
  return (
    <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col">
      <main className="flex-1">
        <ListPageHeader title="Docs" description={DESCRIPTION} />
        <section aria-label="Docs" className="mx-auto w-full max-w-page px-gutter pb-section">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((doc) => (
              <li key={doc.slug}>
                <Link href={doc.href} className="group/doc block h-full rounded-4xl outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
                  <Card className="h-full transition-colors group-hover/doc:bg-secondary">
                    <CardHeader>
                      <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted">
                        <HugeiconsIcon icon={docIconOf(doc.icon)} strokeWidth={2} className="size-6" aria-hidden="true" />
                      </span>
                      <CardTitle className="text-xl">{doc.title}</CardTitle>
                      {doc.description && <CardDescription className="text-base">{doc.description}</CardDescription>}
                    </CardHeader>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
