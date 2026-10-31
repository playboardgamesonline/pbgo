import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { LANDING } from "@pbgo/docs"
import { Markdown } from "@pbgo/docs/markdown"
import { getDocPage, getSections } from "@pbgo/docs/server"

// A page of the docs: `/docs/<section>` is the landing page of a section (`docs/<section>/index.md`) and `/docs/<section>/<page>` another file of its folder. Every page is built with the site, from the files `@pbgo/docs` finds, and
// a name that is not one of them answers 404, and so does a path of more than one segment. The address of a landing page is its section's (its canonical): `index` is not the name of a page of its own. Nothing is read but a file
// `@pbgo/docs` found, whatever the address says.
// The site serves the pages of its build and nothing else (`dynamicParams` off, which Next wants as a literal): an address that is not one answers 404 with no function to run, and no function reads `docs/` when the site is up, where
// the folder is not. The price is paid in development: the pages are listed when the server starts, so a file added while `pnpm dev` runs is in the menu (the layout reads the folder at each request) but answers 404 until the server
// is restarted. A file that is edited, not added, shows at once.
export const dynamicParams = false

export async function generateStaticParams() {
  const sections = await getSections()
  return sections.flatMap((section) => section.pages.map((page) => ({ section: section.slug, page: page.file === LANDING ? [] : [page.file] })))
}

/** The page of the address, or null: one segment after the section at most, and not `index`. */
async function pageOf(params: Promise<{ section: string; page?: string[] }>) {
  const { section, page = [] } = await params
  if (page.length > 1 || page[0] === LANDING) return null
  return getDocPage(section, page[0])
}

export async function generateMetadata({ params }: PageProps<"/docs/[section]/[[...page]]">): Promise<Metadata> {
  const doc = await pageOf(params)
  if (!doc) return {}
  return { title: `${doc.page.title} · Docs`, alternates: { canonical: doc.page.href } }
}

export default async function DocsPageOfSection({ params }: PageProps<"/docs/[section]/[[...page]]">) {
  const doc = await pageOf(params)
  if (!doc) notFound()
  return <Markdown markdown={doc.markdown} section={doc.section.slug} />
}
