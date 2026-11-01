import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { addressOf, buildSections, flatten, isDocName, resolveLink, specimenBlocksOf } from "./docs"
import { Markdown } from "./markdown"
import { findDocsDir, getDocPage, getSections, getSpecimenNames, readDocFiles } from "./server"

// `server-only` throws outside a server bundle
vi.mock("server-only", () => ({}))

let root: string

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "pbgo-docs-"))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

const write = async (relative: string, text: string) => {
  const file = path.join(root, relative)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, text)
}

const named = (files: { dir: readonly string[]; file: string }[]) => files.map((file) => [...file.dir, file.file].join("/")).sort()

describe("readDocFiles", () => {
  it("reads the markdown files of the folders of the docs, the folders of the folders too, and nothing else", async () => {
    await write("design/index.md", "# Design")
    await write("design/tokens.md", "# Tokens")
    await write("design/03-components/index.md", "# Components")
    await write("design/03-components/01-controls.md", "# Controls")
    await write("engine/index.md", "# Engine")
    await write("design/notes.txt", "not markdown")
    await write("design/Upper.md", "# a name that is not a word")
    await write("design/Nested_Name/deep.md", "# a folder that is not a word")
    await write("Bad_Name/index.md", "# a folder that is not a word")
    await write("loose.md", "# a doc that is not in a section yet")
    const files = await readDocFiles(root)
    expect(named(files)).toEqual(["design/03-components/01-controls", "design/03-components/index", "design/index", "design/tokens", "engine/index"])
    expect(files.find((file) => file.file === "01-controls")).toEqual({ dir: ["design", "03-components"], file: "01-controls", markdown: "# Controls" })
  })

  it("does not follow a link to somewhere else", async () => {
    await write("design/index.md", "# Design")
    await write("outside/secret.md", "# Secret")
    await symlink(path.join(root, "outside"), path.join(root, "linked"))
    await symlink(path.join(root, "outside", "secret.md"), path.join(root, "design", "secret.md"))
    await symlink(path.join(root, "outside"), path.join(root, "design", "folder"))
    const files = await readDocFiles(root)
    expect(named(files)).toEqual(["design/index", "outside/secret"])
  })

  it("builds the sections it reads", async () => {
    await write("design/index.md", "# Design system\n\nThe tokens.")
    await write("design/01-rules/index.md", "# Rules")
    await write("engine/index.md", "# Engine")
    const sections = buildSections(await readDocFiles(root))
    expect(sections.map((section) => section.title)).toEqual(["Design system", "Engine"])
    expect(sections[0]?.pages.map((page) => page.href)).toEqual(["/docs/design/rules"])
  })
})

describe("findDocsDir", () => {
  it("is the docs/ next to the nearest pnpm-workspace.yaml above", async () => {
    await write("pnpm-workspace.yaml", "packages: []\n")
    await mkdir(path.join(root, "apps", "web"), { recursive: true })
    expect(await findDocsDir(path.join(root, "apps", "web"))).toBe(path.join(root, "docs"))
  })
})

describe("the docs of this repo", () => {
  it("make sections, and the design system and the engine are among them", async () => {
    const sections = await getSections()
    expect(sections.map((section) => section.slug)).toEqual(expect.arrayContaining(["design", "engine"]))
    for (const section of sections) expect(section.href, section.slug).toBe(`/docs/${section.slug}`)
  })

  it("find a page by its address, with the folders its file is in, and nothing for an address that is not a page", async () => {
    const design = await getDocPage(["design"])
    expect(design?.page.href).toBe("/docs/design")
    expect(design?.markdown).toMatch(/^# /m)
    expect(design?.dir).toEqual(["design"])
    for (const address of [["design", "nope"], ["nope"], [".."], ["design", "../design"], ["design/"], ["design", "index"], []]) {
      expect(await getDocPage(address), address.join("/")).toBeNull()
    }
  })

  it("have a title and a well-formed address for every page, and no address twice", async () => {
    const hrefs = flatten(await getSections()).map((page) => {
      expect(page.title, page.href).not.toBe("")
      for (const word of page.segments) expect(isDocName(word), `${page.href}: ${word}`).toBe(true)
      return page.href
    })
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it("show only specimens that have a well-formed name", async () => {
    for (const name of await getSpecimenNames()) expect(isDocName(name), name).toBe(true)
  })

  it("link to pages and to headings that exist", async () => {
    const sections = await getSections()
    const stub = new Proxy({}, { get: () => () => null })
    const anchors = new Map<string, Set<string>>()
    const pages = await Promise.all(flatten(sections).map(async (page) => ({ href: page.href, doc: await getDocPage(page.segments) })))
    for (const { href, doc } of pages) {
      if (!doc) throw new Error(`${href} is in the menu and has no text`)
      const html = renderToStaticMarkup(React.createElement(Markdown, { markdown: doc.markdown, dir: doc.dir, specimens: stub }))
      anchors.set(href, new Set([...html.matchAll(/ id="([^"]+)"/g)].map((match) => match[1] ?? "")))
    }
    const broken: string[] = []
    for (const { href, doc } of pages) {
      if (!doc) continue
      // Links of a text, not of a block of code: what is fenced is left out
      const text = doc.markdown.replace(/^( {0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1?\2[ \t]*$/gm, "")
      for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
        const link = resolveLink(target, { dir: doc.dir })
        if (link.kind === "anchor") {
          if (!anchors.get(href)?.has(link.href.slice(1))) broken.push(`${href} → ${target}`)
        } else if (link.kind === "page") {
          const [to = "", hash] = link.href.split("#")
          if (!anchors.has(to)) broken.push(`${href} → ${target} (no such page)`)
          else if (hash && !anchors.get(to)?.has(hash)) broken.push(`${href} → ${target} (no such heading)`)
        }
      }
    }
    expect(broken).toEqual([])
  })
})

describe("the specimens of the docs of this repo", () => {
  it("are not shown twice in a page with the same lines: that would be a copy that was not meant", async () => {
    const files = await readDocFiles(await findDocsDir())
    for (const file of files) {
      const keys = specimenBlocksOf(file.markdown).map((block) => `${block.name}\n${block.body}`)
      expect(new Set(keys).size, `${addressOf(file).join("/")} shows a specimen twice`).toBe(keys.length)
    }
  })
})
