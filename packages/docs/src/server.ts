import "server-only"
import { access, readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { cache } from "react"
import { LANDING, buildSections, isDocName, pageNameOf, type DocFile, type DocPage, type DocSection } from "./docs"

// The reader of the docs/ folder, for apps/web: it runs when the pages are built (they are static), reads each section folder of `docs/` and the markdown files in it, and gives the model of `docs.ts` the text.
// A page is looked up among the files it found, by name, and a path is never made from what the visitor wrote: a name that is not a file of the docs finds nothing, whatever it says.

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
 * Every markdown file of every section folder of `dir`. A folder or a file whose name is not one of the `isDocName` words is left alone, and so is what is not a plain folder or a plain file (a link to somewhere else is not followed),
 * as are the files at the top of `dir` (the docs that are not in a section yet, and are not pages).
 */
export async function readDocFiles(dir: string): Promise<DocFile[]> {
  const folders = (await readdir(dir, { withFileTypes: true })).filter((entry) => entry.isDirectory() && isDocName(entry.name))
  const perFolder = await Promise.all(
    folders.map(async (folder) => {
      const entries = await readdir(path.join(dir, folder.name), { withFileTypes: true })
      const names = entries.flatMap((entry) => {
        const file = entry.isFile() ? pageNameOf(entry.name) : null
        return file === null ? [] : [file]
      })
      return Promise.all(names.map(async (file) => ({ section: folder.name, file, markdown: await readFile(path.join(dir, folder.name, `${file}.md`), "utf8") })))
    }),
  )
  return perFolder.flat()
}

/** The files and the sections, read once per request however many times the layout and the page ask. */
const load = cache(async () => {
  const files = await readDocFiles(await findDocsDir())
  return { files, sections: buildSections(files) }
})

/** The sections of the docs, for the menu and the pages to build. */
export async function getSections(): Promise<DocSection[]> {
  return (await load()).sections
}

/** A page of a section, with its text: the landing page when `file` is not given. Null for a name that is not a page of the docs. */
export async function getDocPage(section: string, file: string = LANDING): Promise<{ section: DocSection; page: DocPage; markdown: string } | null> {
  const { files, sections } = await load()
  const source = files.find((candidate) => candidate.section === section && candidate.file === file)
  const owner = sections.find((candidate) => candidate.slug === section)
  const page = owner?.pages.find((candidate) => candidate.file === file)
  return source && owner && page ? { section: owner, page, markdown: source.markdown } : null
}
