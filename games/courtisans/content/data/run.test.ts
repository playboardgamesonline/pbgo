import { run } from "@pbgo/content-kit/seed"
import type { RunOptions } from "@pbgo/content-kit/seed"
import { MemoryStore } from "@pbgo/content-kit/testing"
import { describe, expect, it } from "vitest"
import { familyId } from "./families.ts"
import { buildSeedDocs } from "./index.ts"
import { MISSION_IDS } from "./missions.ts"
import { roleId } from "./roles.ts"
import { TEXTS_ID } from "./texts.ts"

// The runner itself is tested in @pbgo/content-kit; these tests run Courtisans' own seed through it, with no art: the images are already in the Studio.

const apply: RunOptions = { apply: true, overwrite: false, only: [] }

const isDraft = (id: string) => id.startsWith("drafts.")

describe("the Courtisans seed", () => {
  const seed = buildSeedDocs()
  const everything = (store: MemoryStore, options: RunOptions) => run({ store, docs: buildSeedDocs(), slots: [], options })

  it("writes every document as a draft in one transaction, and nothing else", async () => {
    const store = new MemoryStore()
    const result = await everything(store, apply)
    expect(result.seedCount).toBe(seed.length)
    expect(result.written).toBe(seed.length)
    expect(store.writes).toHaveLength(1)
    expect(store.writes[0]).toHaveLength(seed.length)
    expect(store.docs.size).toBe(seed.length)
    expect([...store.docs.keys()].every(isDraft)).toBe(true)
    expect(store.uploads).toEqual([])
    expect(result.orphans).toEqual([])
  })

  it("does nothing the second time", async () => {
    const store = new MemoryStore()
    await everything(store, apply)
    const again = await everything(store, apply)
    expect(again.written).toBe(0)
    expect(again.plan.every((item) => item.action === "unchanged" && item.changes.length === 0)).toBe(true)
    expect(store.writes).toHaveLength(1)
  })

  it("does nothing once the drafts were published in the Studio, and creates no draft", async () => {
    const store = new MemoryStore()
    await everything(store, apply)
    for (const doc of seed) store.publish(doc._id)
    const again = await everything(store, apply)
    expect(again.written).toBe(0)
    expect(again.plan.every((item) => item.action === "unchanged")).toBe(true)
    expect([...store.docs.keys()].some(isDraft)).toBe(false)
  })

  it("makes a draft from a published document that lost a field, and leaves the published one as it is", async () => {
    const store = new MemoryStore()
    await everything(store, apply)
    for (const doc of seed) store.publish(doc._id)
    const id = familyId("butterfly")
    store.edit(id, (doc) => {
      delete doc.name
    })
    const published = structuredClone(store.docs.get(id))

    const result = await everything(store, apply)

    expect(result.plan.filter((item) => item.action !== "unchanged").map((item) => [item.id, item.action])).toEqual([[id, "create-from-published"]])
    expect(store.docs.get(id)).toEqual(published)
    expect(store.docs.get(`drafts.${id}`)?.name).toEqual(seed.find((doc) => doc._id === id)?.name)
  })
})

// The state of the live dataset when the seed was written: the documents of the Studio are published, they hold their own fields (key, colour, pictograms,
// card, condition…) and only a part of the translations, and three missions have no counterpart in the seed.
describe("the Courtisans seed, run on a dataset like the live one", () => {
  const LEFT_OUT = ["mission-dark-8", "mission-dark-9", "mission-dark-10"]
  const everything = (store: MemoryStore, options: RunOptions = apply) => run({ store, docs: buildSeedDocs(), slots: [], options })

  /** The published documents of the Studio: the French only (no `_type` on the older objects), and everything the seed does not write. */
  function live() {
    const store = new MemoryStore()
    store.put({ _id: "texts", _type: "texts", missionsButton: { _type: "localeString", fr: "J'AI PRIS CONNAISSANCE DES MISSIONS !", en: "Missions understood" }, victoryPhrases: { _type: "localeStringList", fr: ["un", "deux", "trois", "quatre", "cinq", "six"] }, errorMessages: [], ui_lobby: {} })
    for (const key of ["butterfly", "toad", "nightingale", "hare", "stag", "carp"] as const) {
      store.put({ _id: familyId(key), _type: "family", key, color: "#336699", name: { fr: key }, pictogram: { _type: "image", asset: { _type: "reference", _ref: `image-${key}-1x1-png` } } })
    }
    for (const key of ["noble", "spy", "assassin", "guard"] as const) {
      store.put({ _id: roleId(key), _type: "role", key, countPerFamily: 2, name: { fr: key }, rule: { fr: `la règle du ${key}` } })
    }
    for (const id of [...MISSION_IDS, ...LEFT_OUT]) store.put({ _id: id, _type: "mission", color: "white", text: { _type: "localeText", fr: id }, condition: { _type: "condition", kind: "familiesWithStatus" } })
    return store
  }

  it("makes a draft of each published document, leaves the published ones untouched and reports the missions it does not manage", async () => {
    const store = live()
    const before = new Map([...store.docs].map(([id, doc]) => [id, structuredClone(doc)]))
    const result = await everything(store)

    expect(result.plan.map((item) => item.action)).toEqual(buildSeedDocs().map(() => "create-from-published"))
    expect(result.written).toBe(buildSeedDocs().length)
    for (const [id, doc] of before) expect(store.docs.get(id), id).toEqual(doc)
    expect([...result.orphans].sort()).toEqual([...LEFT_OUT].sort())
  })

  it("adds the translations to the draft and keeps the fields the seed does not write", async () => {
    const store = live()
    await everything(store)

    const family = store.docs.get(`drafts.${familyId("hare")}`)
    expect(family).toMatchObject({ key: "hare", color: "#336699", pictogram: { _type: "image" } })
    expect(family?.name).toMatchObject({ _type: "localeString", fr: "hare", en: "Hare", es: "Liebre", de: "Hase" })

    const mission = store.docs.get("drafts.mission-light-1")
    expect(mission).toMatchObject({ color: "white", condition: { kind: "familiesWithStatus" } })
    expect(mission?.text).toMatchObject({ _type: "localeText", fr: "mission-light-1" })
    expect((mission?.text as { en: string }).en).toContain("carp")
  })

  it("keeps what the Studio already says when it differs from the code, and fills the languages around it", async () => {
    const store = live()
    await everything(store)

    const texts = store.docs.get("drafts.texts")
    // the French rule and button the editors wrote stay; the other languages arrive
    expect(store.docs.get(`drafts.${roleId("spy")}`)?.rule).toMatchObject({ fr: "la règle du spy" })
    expect(texts?.missionsButton).toMatchObject({ fr: "J'AI PRIS CONNAISSANCE DES MISSIONS !", en: "Missions understood" })
    expect((texts?.missionsButton as { es: string; de: string }).es.length).toBeGreaterThan(0)
    expect((texts?.missionsButton as { es: string; de: string }).de.length).toBeGreaterThan(0)
    // the six French sentences of the Studio are not replaced by the three of the code
    expect((texts?.victoryPhrases as { fr: string[] }).fr).toEqual(["un", "deux", "trois", "quatre", "cinq", "six"])
    expect((texts?.victoryPhrases as { en: string[] }).en).toHaveLength(3)
    expect(texts?.errorMessages).toHaveLength(12)
  })

  it("does nothing the second time, whatever the Studio kept", async () => {
    const store = live()
    await everything(store)
    const again = await everything(store)
    expect(again.written).toBe(0)
    expect(again.plan.every((item) => item.action === "unchanged")).toBe(true)
    expect(store.writes).toHaveLength(1)
    expect(TEXTS_ID).toBe("texts")
  })
})
