// The docs/ folder of the repo as pages of the site, one source and nothing written twice: a SECTION is a folder of `docs/`, a PAGE is a markdown file in it, and a folder of a section is a GROUP, a landing page with pages of its own. `index.md` is the
// landing page of a folder (`docs/design/index.md` is `/docs/design`, `docs/design/foo.md` is `/docs/design/foo`, `docs/design/bar/index.md` is `/docs/design/bar` and `docs/design/bar/baz.md` is `/docs/design/bar/baz`). The title of a page is
// its first `# ` heading and the menu follows the disk: the landing page first, then what is in the folder in the order of the names, where a number in front of a name, `03-components`, puts it in its place and is not part of the address
// (that page is `/docs/design/components`). A folder, a file or a link is read only if its name is one of the `isDocName` words, since the name is the address.
// A page can show a live specimen of the site: a fenced block of the language `specimen` whose text is the name of a specimen of the app (`specimensOf` lists them; the renderer, `markdown.tsx`, draws them).
// Pure, like `@pbgo/catalog`'s model: no I/O (the reader is `server.ts`) and no framework.

export const DOCS_HREF = "/docs"

/** The file that is the landing page of a folder. */
export const LANDING = "index"

/** What a folder or a file of the docs may be called, without `.md`: words of lowercase letters and digits joined by single dashes. It is the address of the page too, so nothing else is read from the disk. */
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const isDocName = (name: string): boolean => NAME.test(name)

/** `foo-bar.md` is `foo-bar`; anything that is not the file of a page (another extension, a name that is not a word) is null. */
export function pageNameOf(fileName: string): string | null {
  if (!fileName.endsWith(".md")) return null
  const name = fileName.slice(0, -".md".length)
  return isDocName(name) ? name : null
}

const ORDERED = /^(\d+)-(.+)$/

/** A name as the disk has it, in two parts: the number in front of it, if there is one, which puts it in its place in the menu, and the rest, which is its address (`03-components` is the third and `components`). A number alone is a word, not an order. */
export function parseName(name: string): { order: number | null; slug: string } {
  const [, digits, rest] = ORDERED.exec(name) ?? []
  return digits !== undefined && rest !== undefined && isDocName(rest) ? { order: Number(digits), slug: rest } : { order: null, slug: name }
}

/** A markdown file as the reader finds it: the folders it is in below `docs/` (the first is its section) and its name without `.md`, both as the disk has them, and its text. */
export type DocFile = { dir: readonly string[]; file: string; markdown: string }

/** A page in the menu: where it is on the site (one word for each folder and one for the file, the numbers of the disk taken off), its title and its address, and, when it is the landing page of a folder, the pages of that folder after it, a group being a landing page with its own `pages`. */
export type DocPage = { segments: readonly string[]; title: string; href: string; pages: readonly DocPage[] }

/** A section: the landing page of a folder of `docs/` with the first lines of it as a summary, which is what its card says. */
export type DocSection = DocPage & { slug: string; summary: string }

/** The words of the address of a file below `/docs`: its folders and its name with the numbers of the disk taken off, a landing page having its folder's. */
export function addressOf(file: Pick<DocFile, "dir" | "file">): string[] {
  const folders = file.dir.map((name) => parseName(name).slug)
  return file.file === LANDING ? folders : [...folders, parseName(file.file).slug]
}

/** Where a page is on the site: `/docs/<section>` for the landing page of a section, `/docs/<section>/<group>/<page>` for a page in a group. */
export const hrefOf = (segments: readonly string[]): string => [DOCS_HREF, ...segments].join("/")

/** The words of a markdown text, as a menu or a card says them: no code marks, no emphasis marks, a link is its text. */
const plain = (text: string): string =>
  text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*]/g, "")
    .replace(/\s+/g, " ")
    .trim()

/** `game-ui` is "Game ui": what a page is called when its file has no heading. */
const humanize = (name: string): string => {
  const words = name.replace(/-/g, " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const FENCE = /^\s*(?:```|~~~)/

/** The title of a markdown text: its first `# ` heading, one in a fenced block not counting, else `fallback`. */
export function titleOf(markdown: string, fallback: string): string {
  let fenced = false
  for (const line of markdown.split("\n")) {
    if (FENCE.test(line)) fenced = !fenced
    else if (!fenced) {
      const heading = /^# +(.+?)\s*#*\s*$/.exec(line)
      if (heading?.[1]) return plain(heading[1]) || fallback
    }
  }
  return fallback
}

/** The first paragraph of a markdown text, in plain words and cut to `max` characters at a word: what a card says of a section. A heading, a list, a table, a quote and a fenced block are not a paragraph. */
export function summaryOf(markdown: string, max = 200): string {
  let fenced = false
  const paragraph: string[] = []
  for (const line of markdown.split("\n")) {
    if (FENCE.test(line)) {
      fenced = !fenced
      if (paragraph.length > 0) break
      continue
    }
    if (fenced) continue
    if (line.trim() === "" || /^(?:#|[-*+] |\d+\. |\||>)/.test(line)) {
      if (paragraph.length > 0) break
      continue
    }
    paragraph.push(line.trim())
  }
  const text = plain(paragraph.join(" "))
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const at = cut.lastIndexOf(" ")
  return `${cut.slice(0, at > max / 4 ? at : max).replace(/[.,;:\s]+$/, "")}…`
}

/** The language of a fenced block that shows a live specimen of the site instead of code. */
export const SPECIMEN = "specimen"

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})[ \t]*([^`\s]*)/

/** The name of a specimen and what the block says after it: the first line of a `specimen` block is the name, the other lines are the words the specimen is given (a table of tokens, for one that draws a table with live values). */
export function splitSpecimen(text: string): { name: string; body: string } {
  const [first = "", ...rest] = text.trim().split("\n")
  return { name: first.trim(), body: rest.join("\n").trim() }
}

/** The specimens a markdown text shows, in order: the name and the lines after it of each fenced block whose language is `specimen`. */
export function specimenBlocksOf(markdown: string): { name: string; body: string }[] {
  const blocks: { name: string; body: string }[] = []
  let open: { char: string; length: number; language: string; lines: string[] } | null = null
  for (const line of markdown.split("\n")) {
    if (!open) {
      const match = FENCE_OPEN.exec(line)
      const fence = match?.[1]
      if (fence) open = { char: fence.charAt(0), length: fence.length, language: match[2] ?? "", lines: [] }
      continue
    }
    const closing = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line)?.[1]
    if (closing && closing.charAt(0) === open.char && closing.length >= open.length) {
      if (open.language === SPECIMEN) blocks.push(splitSpecimen(open.lines.join("\n")))
      open = null
    } else open.lines.push(line)
  }
  return blocks
}

/** The names of the specimens a markdown text shows, in order. A name used twice is listed twice. */
export const specimensOf = (markdown: string): string[] => specimenBlocksOf(markdown).map((block) => block.name)

/** A page or a group of the menu before it has its place: the number of its name, its address word and what it is. */
type Entry = { order: number | null; slug: string; page: DocPage }

/** The numbered first, in their order, then the others by name (numbers in their order). */
const byOrder = (a: Entry, b: Entry): number => (a.order ?? Infinity) - (b.order ?? Infinity) || a.slug.localeCompare(b.slug, "en", { numeric: true })

/** The folders of the docs and their files, as the disk has them. */
type Folder = { files: DocFile[]; folders: Map<string, Folder> }

const folderOf = (): Folder => ({ files: [], folders: new Map() })

/** The landing page of a folder, with the pages of the folder under it in the order of the menu. */
function pageOfFolder(folder: Folder, dir: readonly string[]): DocPage {
  const where = `docs/${dir.join("/")}/`
  const landing = folder.files.find((file) => file.file === LANDING)
  if (!landing) throw new Error(`${where} has no ${LANDING}.md: it is the landing page of the folder`)
  const segments = dir.map((name) => parseName(name).slug)
  const entries: Entry[] = [
    ...folder.files
      .filter((file) => file !== landing)
      .map((file) => {
        const { order, slug } = parseName(file.file)
        const own = [...segments, slug]
        return { order, slug, page: { segments: own, title: titleOf(file.markdown, humanize(slug)), href: hrefOf(own), pages: [] } }
      }),
    ...[...folder.folders].map(([name, child]) => ({ ...parseName(name), page: pageOfFolder(child, [...dir, name]) })),
  ]
  const seen = new Set<string>()
  for (const { slug } of entries) {
    if (slug === LANDING) throw new Error(`${where}: ${LANDING} is the name of a landing page, not of a page or a folder, whatever number is in front of it`)
    if (seen.has(slug)) throw new Error(`${where} has two entries that are called ${slug}: a number in front of a name is not part of its address`)
    seen.add(slug)
  }
  const last = segments.at(-1) ?? ""
  return { segments, title: titleOf(landing.markdown, humanize(last)), href: hrefOf(segments), pages: entries.sort(byOrder).map((entry) => entry.page) }
}

/**
 * The sections of the docs, in the order of the menu, each with its pages. A folder has to have its landing page, in a section as in a group: a folder without `index.md` is a mistake that stops the build, not a page that is quietly
 * left out. A file that is not in a folder of `docs/` is not a page.
 */
export function buildSections(files: readonly DocFile[]): DocSection[] {
  const root = folderOf()
  for (const file of files) {
    if (file.dir.length === 0) continue
    let folder = root
    for (const name of file.dir) {
      let next = folder.folders.get(name)
      if (!next) {
        next = folderOf()
        folder.folders.set(name, next)
      }
      folder = next
    }
    folder.files.push(file)
  }
  const entries: (Entry & { landing: DocFile | undefined })[] = [...root.folders].map(([name, folder]) => {
    const page = pageOfFolder(folder, [name])
    return { ...parseName(name), page, landing: folder.files.find((file) => file.file === LANDING) }
  })
  return entries.sort(byOrder).map(({ slug, page, landing }) => ({ ...page, slug, summary: summaryOf(landing?.markdown ?? "") }))
}

/** Every page of a list and of the pages under them, each one before its own pages: the pages of the site, and the order of the menu. */
export function flatten(pages: readonly DocPage[]): DocPage[] {
  return pages.flatMap((page) => [page, ...flatten(page.pages)])
}

/** The page at an address (one word for each folder and one for the file, `["design", "components", "controls"]`), or null. */
export function findPage(sections: readonly DocSection[], segments: readonly string[]): DocPage | null {
  return flatten(sections).find((page) => page.segments.length === segments.length && page.segments.every((word, index) => word === segments[index])) ?? null
}

/** What a link of a page leads to: somewhere on the same page, another site, another page of the docs, or a file of the repo that has no page (it is shown as a name, since there is nothing to open). Nothing for what is empty or unsafe. */
export type ResolvedLink =
  | { kind: "anchor"; href: string }
  | { kind: "external"; href: string }
  | { kind: "page"; href: string }
  | { kind: "file"; path: string }
  | { kind: "none" }

/** The names a relative path leads to from a folder of the docs, or null when it climbs out of `docs/`. */
function resolveFrom(dir: readonly string[], relative: string): string[] | null {
  const names = [...dir]
  for (const part of relative.split("/")) {
    if (part === "" || part === ".") continue
    if (part === "..") {
      if (names.length === 0) return null
      names.pop()
    } else names.push(part)
  }
  return names
}

/**
 * Where a link of a page leads: a relative `.md` link to another page of the docs is that page on the site, with its `#anchor`. It is read the way the disk has it, so that it works on GitHub too (`../02-foundations.md`, `01-controls.md`),
 * and gives the address of the page (`/docs/design/foundations`). `from.dir` is the folders the page is in below `docs/`.
 */
export function resolveLink(href: string | undefined, from: { dir: readonly string[] }): ResolvedLink {
  if (!href) return { kind: "none" }
  if (href.startsWith("#")) return { kind: "anchor", href }
  if (/^(?:https?:|mailto:)/i.test(href)) return { kind: "external", href }
  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(href)) return { kind: "none" }
  const [pathPart = "", hash] = href.split("#", 2)
  const names = resolveFrom(from.dir, pathPart)
  const fileName = names?.at(-1)
  const folders = names?.slice(0, -1) ?? []
  const file = fileName === undefined ? null : pageNameOf(fileName)
  if (file !== null && folders.length > 0 && folders.every(isDocName)) return { kind: "page", href: hrefOf(addressOf({ dir: folders, file })) + (hash ? `#${hash}` : "") }
  return { kind: "file", path: href }
}
