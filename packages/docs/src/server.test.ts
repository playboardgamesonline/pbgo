import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { buildSections } from "./docs"
import { findDocsDir, getDocPage, getSections, readDocFiles } from "./server"

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

describe("readDocFiles", () => {
  it("reads the markdown files of the folders of the docs, and nothing else", async () => {
    await write("design/index.md", "# Design")
    await write("design/tokens.md", "# Tokens")
    await write("engine/index.md", "# Engine")
    await write("design/notes.txt", "not markdown")
    await write("design/Upper.md", "# a name that is not a word")
    await write("design/nested/deep.md", "# a folder in a section")
    await write("Bad_Name/index.md", "# a folder that is not a word")
    await write("loose.md", "# a doc that is not in a section yet")
    const files = await readDocFiles(root)
    expect(files.map((file) => `${file.section}/${file.file}`).sort()).toEqual(["design/index", "design/tokens", "engine/index"])
    expect(files.find((file) => file.file === "tokens")?.markdown).toBe("# Tokens")
  })

  it("does not follow a link to somewhere else", async () => {
    await write("design/index.md", "# Design")
    await write("outside/secret.md", "# Secret")
    await symlink(path.join(root, "outside"), path.join(root, "linked"))
    await symlink(path.join(root, "outside", "secret.md"), path.join(root, "design", "secret.md"))
    const files = await readDocFiles(root)
    expect(files.map((file) => `${file.section}/${file.file}`).sort()).toEqual(["design/index", "outside/secret"])
  })

  it("builds the sections it reads", async () => {
    await write("design/index.md", "# Design system\n\nThe tokens.")
    await write("engine/index.md", "# Engine")
    expect(buildSections(await readDocFiles(root)).map((section) => section.title)).toEqual(["Design system", "Engine"])
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
  it("make sections that each have a landing page, and the design system and the engine are among them", async () => {
    const sections = await getSections()
    expect(sections.map((section) => section.slug)).toEqual(expect.arrayContaining(["design", "engine"]))
    for (const section of sections) expect(section.pages[0]?.file, section.slug).toBe("index")
  })

  it("find a page by its names, and nothing for a name that is not a page", async () => {
    expect((await getDocPage("design"))?.page.href).toBe("/docs/design")
    expect((await getDocPage("design"))?.markdown).toMatch(/^# /m)
    for (const [section, file] of [["design", "nope"], ["nope", "index"], ["..", "index"], ["design", "../design/index"], ["design/", "index"]] as const) {
      expect(await getDocPage(section, file), `${section}/${file}`).toBeNull()
    }
  })
})
