import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { LANDING, flatten } from "@pbgo/docs"
import { Markdown } from "@pbgo/docs/markdown"
import { getDocPage, getSections, getSpecimenNames } from "@pbgo/docs/server"
import { SPECIMENS } from "../../_specimens"

// A page of the docs: `/docs/<section>` is the landing page of a section (`docs/<section>/index.md`), `/docs/<section>/<page>` another file of its folder and `/docs/<section>/<group>/<page>` a file of a folder of it, each folder having its landing
// page (`docs/<section>/<group>/index.md` is `/docs/<section>/<group>`). Every page is built with the site, from the files `@pbgo/docs` found, and a name that is not one of them answers 404. The address of a landing page is its folder's
// (its canonical): `index` is not the name of a page of its own. Nothing is read but a file `@pbgo/docs` found, whatever the address says.
// The site serves the pages of its build and nothing else (`dynamicParams` off, which Next wants as a literal): an address that is not one answers 404 with no function to run, and no function reads `docs/` when the site is up, where
// the folder is not. The price is paid in development: the pages are listed when the server starts, so a file added while `pnpm dev` runs is in the menu (the layout reads the folder at each request) but answers 404 until the server
// is restarted. A file that is edited, not added, shows at once.
export const dynamicParams = false

export async function generateStaticParams() {
  const sections = await getSections()
  // Every specimen the pages show has to be one the site registers (the page fails to build otherwise), and every one it registers has to be shown: a specimen that no page asks for is dead code
  const shown = await getSpecimenNames()
  const unused = Object.keys(SPECIMENS).filter((name) => !shown.has(name))
  if (unused.length > 0) throw new Error(`These specimens are registered and no page of docs/ shows them: ${unused.join(", ")}. Show them, or delete them.`)
  return flatten(sections).map(({ segments: [section = "", ...page] }) => ({ section, page }))
}

/** The page of the address, or null: not one that says `index`, which is not the name of a page. */
async function pageOf(params: Promise<{ section: string; page?: string[] }>) {
  const { section, page = [] } = await params
  const segments = [section, ...page]
  if (segments.includes(LANDING)) return null
  return getDocPage(segments)
}

export async function generateMetadata({ params }: PageProps<"/docs/[section]/[[...page]]">): Promise<Metadata> {
  const doc = await pageOf(params)
  if (!doc) return {}
  const group = doc.page.href === doc.section.href ? "" : ` · ${doc.section.title}`
  return { title: `${doc.page.title}${group} · Docs`, alternates: { canonical: doc.page.href } }
}

export default async function DocsPageOfSection({ params }: PageProps<"/docs/[section]/[[...page]]">) {
  const doc = await pageOf(params)
  if (!doc) notFound()
  return <Markdown markdown={doc.markdown} dir={doc.dir} specimens={SPECIMENS} />
}
