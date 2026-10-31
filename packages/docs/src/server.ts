import "server-only"
import { access, readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { cache } from "react"
import { addressOf, buildSections, findPage, hrefOf, isDocName, pageNameOf, specimensOf, type DocFile, type DocPage, type DocSection } from "./docs"

// The reader of the docs/ folder, for apps/web: it runs when the pages are built (they are static), reads each section folder of `docs/`, the folders in them and the markdown files, and gives the model of `docs.ts` the text.
// A page is looked up among the files it found, by its address, and a path is never made from what the visitor wrote: a name that is not a file of the docs finds nothing, whatever it says.

/** The docs/ folder of the repo: next to the `pnpm-workspace.yaml` that is the nearest above `from`, wherever Next or a test runs from. */
export async function findDocsDir(from: string = process.cwd()): Promise<string> {
  for (let dir = from; ; dir = path.dirname(dir)) {
    try {
      await access(path.join(dir, "pnpm-workspace.yaml"))
      return path.join(dir, "docs")
    } catch {
      if (path.dirname(dir) === dir) throw new Error(`No pnpm-workspace.yaml above ${from}: the docs/ folder of the repo cannot be found`)
    }
  }
}

/**
 * Every markdown file of every folder of `dir`, the folders of the folders too. A folder or a file whose name is not one of the `isDocName` words is left alone, and so is what is not a plain folder or a plain file (a link to somewhere else
 * is not followed), as are the files at the top of `dir` (the docs that are not in a section yet, and are not pages).
 */
export async function readDocFiles(dir: string): Promise<DocFile[]> {
  const read = async (folders: readonly string[]): Promise<DocFile[]> => {
    const entries = await readdir(path.join(dir, ...folders), { withFileTypes: true })
    const names = (folders.length === 0 ? [] : entries).flatMap((entry) => {
      const name = entry.isFile() ? pageNameOf(entry.name) : null
      return name === null ? [] : [name]
    })
    const here = await Promise.all(names.map(async (file) => ({ dir: folders, file, markdown: await readFile(path.join(dir, ...folders, `${file}.md`), "utf8") })))
    const below = await Promise.all(entries.filter((entry) => entry.isDirectory() && isDocName(entry.name)).map((entry) => read([...folders, entry.name])))
    return [...here, ...below.flat()]
  }
  return read([])
}

/** The files and the sections, read once per request however many times the layout and the page ask. */
const load = cache(async () => {
  const files = await readDocFiles(await findDocsDir())
  const sections = buildSections(files)
  const byHref = new Map(files.map((file) => [hrefOf(addressOf(file)), file]))
  return { files, sections, byHref }
})

/** The sections of the docs, for the menu and the pages to build. */
export async function getSections(): Promise<DocSection[]> {
  return (await load()).sections
}

/** A page of the docs by its address (one word for each folder and one for the file: `["design"]` for a landing page, `["design", "components", "controls"]` for a page of a group), with its text and the folders its file is in, which its relative links are read from. Null for what is not a page of the docs. */
export async function getDocPage(segments: readonly string[]): Promise<{ section: DocSection; page: DocPage; markdown: string; dir: readonly string[] } | null> {
  const { sections, byHref } = await load()
  const source = byHref.get(hrefOf(segments))
  const page = findPage(sections, segments)
  const section = sections.find((candidate) => candidate.slug === segments[0])
  return source && page && section ? { section, page, markdown: source.markdown, dir: source.dir } : null
}

/** The names of the specimens that the pages show: what the site has to be able to draw, and every specimen it can draw has to be among them. */
export async function getSpecimenNames(): Promise<Set<string>> {
  return new Set((await load()).files.flatMap((file) => specimensOf(file.markdown)))
}
