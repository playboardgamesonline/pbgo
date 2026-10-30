// The docs/ folder of the repo as pages of the site, one source and nothing written twice: a SECTION is a folder of `docs/`, a PAGE is a markdown file in it, and `index.md` is the landing page of the section
// (`docs/design/index.md` is `/docs/design`, `docs/design/foo.md` is `/docs/design/foo`). The title of a page is its first `# ` heading, the menu follows the disk (the landing page first, then the files by name),
// and a folder, a file or a link is read only if its name is one of the `isDocName` words, since the name is the address. Pure, like `@pbgo/catalog`'s model: no I/O (the reader is `server.ts`) and no framework.

export const DOCS_HREF = "/docs"

/** The file that is the landing page of a section. */
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

/** A markdown file as the reader finds it: the folder it is in, its name without `.md` and its text. */
export type DocFile = { section: string; file: string; markdown: string }

/** A page in the menu: its file, its title, and where it is on the site. */
export type DocPage = { file: string; title: string; href: string }

/** A section: its folder, the title of its landing page, the first lines of it as a summary, and its pages with the landing page first. */
export type DocSection = { slug: string; title: string; summary: string; href: string; pages: DocPage[] }

/** Where a page is on the site: `/docs/<section>` for a landing page, `/docs/<section>/<file>` for the others. */
export const hrefOf = (section: string, file: string): string => (file === LANDING ? `${DOCS_HREF}/${section}` : `${DOCS_HREF}/${section}/${file}`)

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

/** The landing page first, then the others by name (numbers in their order). */
const byLanding = (a: DocFile, b: DocFile): number => (a.file === LANDING ? -1 : b.file === LANDING ? 1 : a.file.localeCompare(b.file, "en", { numeric: true }))

/**
 * The sections of the docs, by name, each with its pages in the order of the menu. A section has to have its landing page: a folder without `index.md` is a mistake that stops the build, not a section that is quietly left out.
 */
export function buildSections(files: readonly DocFile[]): DocSection[] {
  const folders = new Map<string, DocFile[]>()
  for (const file of files) folders.set(file.section, [...(folders.get(file.section) ?? []), file])
  return [...folders]
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([slug, list]) => {
      const landing = list.find((file) => file.file === LANDING)
      if (!landing) throw new Error(`docs/${slug}/ has no ${LANDING}.md: it is the landing page of the section`)
      return {
        slug,
        title: titleOf(landing.markdown, humanize(slug)),
        summary: summaryOf(landing.markdown),
        href: hrefOf(slug, LANDING),
        pages: [...list].sort(byLanding).map((file) => ({ file: file.file, title: titleOf(file.markdown, humanize(file.file)), href: hrefOf(slug, file.file) })),
      }
    })
}

/** What a link of a page leads to: somewhere on the same page, another site, another page of the docs, or a file of the repo that has no page (it is shown as a name, since there is nothing to open). Nothing for what is empty or unsafe. */
export type ResolvedLink =
  | { kind: "anchor"; href: string }
  | { kind: "external"; href: string }
  | { kind: "page"; href: string }
  | { kind: "file"; path: string }
  | { kind: "none" }

/** The segments a relative path leads to from a folder of the docs, or null when it climbs out of `docs/`. */
function resolveFrom(section: string, relative: string): string[] | null {
  const segments = [section]
  for (const part of relative.split("/")) {
    if (part === "" || part === ".") continue
    if (part === "..") {
      if (segments.length === 0) return null
      segments.pop()
    } else segments.push(part)
  }
  return segments
}

/** Where a link of a page of `section` leads: a relative `.md` link to another page of the docs is that page on the site, with its `#anchor`. */
export function resolveLink(href: string | undefined, from: { section: string }): ResolvedLink {
  if (!href) return { kind: "none" }
  if (href.startsWith("#")) return { kind: "anchor", href }
  if (/^(?:https?:|mailto:)/i.test(href)) return { kind: "external", href }
  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(href)) return { kind: "none" }
  const [pathPart = "", hash] = href.split("#", 2)
  const segments = resolveFrom(from.section, pathPart)
  const [folder, fileName] = segments ?? []
  const name = fileName === undefined ? null : pageNameOf(fileName)
  if (segments?.length === 2 && folder !== undefined && isDocName(folder) && name !== null) return { kind: "page", href: hrefOf(folder, name) + (hash ? `#${hash}` : "") }
  return { kind: "file", path: href }
}
