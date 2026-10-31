import type { Metadata } from "next"
import Link from "next/link"
import { flatten } from "@pbgo/docs"
import { getSections } from "@pbgo/docs/server"

export const metadata: Metadata = { title: "Docs", description: "The documentation of the repository, rendered from its docs/ folder. Internal reference.", alternates: { canonical: "/docs" } }

/**
 * The way into the docs: a card for each section of the `docs/` folder, with the first lines of its landing page. There is no list to keep here, a new folder of `docs/` is a new card.
 */
export default async function DocsPage() {
  const sections = await getSections()
  return (
    <>
      <div className="flex flex-col gap-4">
        <h1 className="font-heading text-4xl md:text-5xl">Docs</h1>
        <p className="max-w-reading text-lg text-muted-foreground">
          The documentation of the repository, drawn from the markdown files of its <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs tracking-normal">docs/</code> folder: one source, and nothing written twice. A
          folder is a section, a file in it is a page, a folder in it is a group of pages, and the first heading of a file is its title.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => {
          const count = flatten(section.pages).length + 1
          return (
            <li key={section.slug}>
              <Link
                href={section.href}
                className="flex h-full flex-col gap-2 rounded-3xl border p-6 transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none"
              >
                <span className="font-heading text-xl">{section.title}</span>
                {section.summary && <span className="text-muted-foreground">{section.summary}</span>}
                <span className="mt-auto pt-2 text-sm text-muted-foreground">{count === 1 ? "1 page" : `${count} pages`}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}
