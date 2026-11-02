import { studioTypes } from "@pbgo/content-kit/form-rules"
import { describe, expect, it } from "vitest"
import studio from "./sanity.config"
import { defaultDocumentNode, structure } from "./structure"
import { ExpansionsOf } from "./views/expansions-of-view"
import { GamesOf } from "./views/games-of-view"

// The structure builder cannot be made outside the Studio, so this stands in for it: a builder is a record, each call of the chain says one
// thing about it (`title`, `child`, `items`…), and `plain` turns what was built into data to compare. It checks the wiring: what the sidebar
// lists, in which order, and which document gets which tab.

const BUILDER = Symbol("builder")
type Built = { [BUILDER]: Record<string, unknown> }

const builder = (data: Record<string, unknown>): Built =>
  new Proxy({ [BUILDER]: data } as Built, {
    get: (_target, call) => (call === BUILDER ? data : (...args: unknown[]) => builder({ ...data, [String(call)]: args.length === 1 ? args[0] : args })),
  })

const isBuilt = (value: unknown): value is Built => typeof value === "object" && value !== null && BUILDER in value

const plain = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(plain)
  if (isBuilt(value)) return plain(value[BUILDER])
  // the icons are objects too: they are not compared, and are kept as they are
  if (typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, plain(entry)]))
  }
  return value
}

const S = {
  list: () => builder({ node: "list" }),
  listItem: () => builder({ node: "listItem" }),
  documentTypeList: (type: string) => builder({ node: "documentTypeList", type }),
  documentTypeListItem: (type: string) => builder({ node: "documentTypeListItem", type }),
  document: () => builder({ node: "document" }),
  view: { form: () => ({ view: "form" }), component: (component: unknown) => builder({ view: "component", component }) },
} as unknown as Parameters<typeof structure>[0]

type Item = { title?: string; type?: string; child?: { type?: string; defaultOrdering?: unknown }; items?: Item[] }
type Tab = { view: string; title?: string; component?: unknown; options?: unknown }

const blocks = () => (plain(structure(S, {} as never)) as { items: Item[] }).items
const tabsOf = (schemaType: string) => (plain(defaultDocumentNode(S, { schemaType } as never)) as { views: Tab[] }).views

describe("the sidebar", () => {
  it("has three blocks: the Catalog, the Editorial and the Shop", () => {
    expect(blocks().map((block) => block.title)).toEqual(["Catalog", "Editorial", "Shop"])
  })

  it("lists in the Catalog the games, their expansions, then the creators, publishers and categories", () => {
    const catalog = blocks().find((block) => block.title === "Catalog")?.child
    const items = (catalog as { items?: Item[] } | undefined)?.items ?? []
    expect(items.map((item) => [item.title, item.child?.type ?? item.type])).toEqual([
      ["Games", "game"],
      ["Expansions", "expansion"],
      ["Creators", "creator"],
      ["Publishers", "publisher"],
      ["Categories", "category"],
    ])
  })

  it("lists the expansions by name", () => {
    const catalog = (blocks().find((block) => block.title === "Catalog")?.child as { items?: Item[] } | undefined)?.items ?? []
    expect(catalog.find((item) => item.title === "Expansions")?.child?.defaultOrdering).toEqual([{ field: "name", direction: "asc" }])
  })

  it("only lists types the Studio has", () => {
    const types = studioTypes(studio)
    const listed = (node: unknown): string[] => {
      if (Array.isArray(node)) return node.flatMap(listed)
      if (typeof node !== "object" || node === null) return []
      const { type, child, items } = node as { type?: unknown; child?: unknown; items?: unknown }
      return [...(typeof type === "string" ? [type] : []), ...listed(child), ...listed(items)]
    }
    const names = listed(blocks())
    expect(names.length).toBeGreaterThanOrEqual(8)
    for (const type of names) expect(types.get(type)?.type, type).toBe("document")
  })
})

describe("the tabs of a document", () => {
  it("are the form alone for most documents, and for an expansion: nothing points at one", () => {
    for (const type of ["expansion", "category", "article", "changelogEntry", "announcement"]) expect(tabsOf(type), type).toEqual([{ view: "form" }])
  })

  it("add an Expansions tab to a game", () => {
    const tabs = tabsOf("game")
    expect(tabs.map((tab) => tab.title ?? tab.view)).toEqual(["form", "Expansions"])
    expect(tabs[1]?.component).toBe(ExpansionsOf)
  })

  it("add a Games tab to a creator and to a publisher, for the type that holds it", () => {
    for (const type of ["creator", "publisher"]) {
      const tabs = tabsOf(type)
      expect(tabs.map((tab) => tab.title ?? tab.view), type).toEqual(["form", "Games"])
      expect(tabs[1]?.component, type).toBe(GamesOf)
      expect(tabs[1]?.options, type).toEqual({ of: type })
    }
  })
})
