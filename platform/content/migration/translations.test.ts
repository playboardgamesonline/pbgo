import { describe, expect, it } from "vitest"
import { TRANSLATED_FIELDS } from "../../apps/studio/schemaTypes/constants.ts"
import { MemoryDataset, OLD_BARE, OLD_CATEGORY, OLD_EXPANSION, OLD_EXPANSION_DRAFT, OLD_HANABI, OTHERS, changed, picture, studioRow } from "./translations-fixtures.ts"
import { applied, describePlan, migrate, mutationsOf, planTranslations, type Doc } from "./translations.ts"

// The conversion of the catalog to the translated fields (PLT-104), on documents as the dataset holds them today.

const row = (kind: string, language: string, value?: unknown) => ({ _key: language, _type: `internationalizedArray${kind}Value`, language, ...(value === undefined ? {} : { value }) })

const all = [OLD_HANABI, OLD_BARE, OLD_CATEGORY, OLD_EXPANSION, OLD_EXPANSION_DRAFT, ...OTHERS]

/** The one conversion of a document. */
function conversionOf(doc: Doc, others: Doc[] = []) {
  const plan = planTranslations([doc, ...others])
  expect(plan.problems).toEqual([])
  const found = plan.conversions.find((conversion) => conversion.id === doc._id)
  if (!found) throw new Error(`${doc._id} is not converted`)
  return found
}

describe("a game as the dataset holds it today", () => {
  const conversion = conversionOf(OLD_HANABI)

  it("gets its text as the row of English, its picture as the row of English with its hotspot and crop, and its links as rows of rules", () => {
    expect(conversion.set.description).toEqual([row("Description", "en", "A cooperative card game in which nobody sees their own cards.")])
    expect(conversion.set.logo).toEqual([row("Image", "en", OLD_HANABI.logo)])
    expect(conversion.set.cover).toEqual([row("Image", "en", OLD_HANABI.cover)])
    expect(conversion.set.rules).toEqual([row("Url", "en", "https://example.com/hanabi-en.pdf"), row("Url", "fr", "https://example.com/hanabi-fr.pdf")])
  })

  it("keeps the picture whole: its asset, its hotspot, its crop", () => {
    const rows = conversion.set.cover as { value: Record<string, unknown> }[]
    expect(rows[0]?.value).toEqual(picture("cover", { hotspot: { _type: "sanity.imageHotspot", x: 0.4, y: 0.6, height: 0.5, width: 0.5 }, crop: { _type: "sanity.imageCrop", top: 0.1, bottom: 0.1, left: 0, right: 0 } }))
  })

  it("gets the empty row of English in every translated field it has nothing for: the plugin would write it when the document is opened", () => {
    expect(conversion.set.names).toEqual([row("LocalizedName", "en")])
    expect(conversion.set.tagline).toEqual([row("String", "en")])
    expect(conversion.set.boxFront).toEqual([row("Image", "en")])
  })

  it("has a row of English in each of the translated fields of its type, and no field more: nothing is left to write when it is opened", () => {
    const after = applied(OLD_HANABI, conversion)
    for (const name of Object.keys(TRANSLATED_FIELDS.game)) {
      const rows = after[name] as { language: string }[]
      expect(rows.map((entry) => entry.language), name).toContain("en")
    }
    expect(planTranslations([after]).conversions).toEqual([])
  })

  it("loses the four fields of the old model and nothing else: they are the ones taken away, the icon and the background are not touched", () => {
    expect(conversion.unset).toEqual(["rulesEn", "rulesFr"])
    const after = applied(OLD_HANABI, conversion)
    for (const field of ["rulesFr", "rulesEn", "rulesEs", "rulesDe"]) expect(field in after, field).toBe(false)
    for (const field of ["name", "slug", "kind", "order", "playersMin", "playersMax", "categories", "icon", "background", "_id", "_type", "_rev"]) expect(after[field], field).toEqual(OLD_HANABI[field])
    expect(Object.keys(conversion.set).sort()).toEqual(["boxFront", "cover", "description", "logo", "names", "rules", "tagline"])
  })

  it("says what it does to each field, for the dry run", () => {
    expect(conversion.notes).toEqual([
      ["names", "nothing → an empty English row", "nothing → an empty English row"],
      ["tagline", "nothing → an empty English row", "nothing → an empty English row"],
      ["description", "a text → English", "a text → English"],
      ["rules", "the old links → rows", "rulesEn, rulesFr → en, fr"],
      ["logo", "a picture → English", "a picture → English"],
      ["cover", "a picture → English", "a picture → English"],
      ["boxFront", "nothing → an empty English row", "nothing → an empty English row"],
    ])
  })

  it("is patched in place, on the revision it was read at", () => {
    expect(mutationsOf(planTranslations([OLD_HANABI]))).toEqual([{ patch: { id: "game-hanabi", ifRevisionID: "rev-hanabi", set: conversion.set, unset: ["rulesEn", "rulesFr"] } }])
  })
})

describe("a game that has almost nothing", () => {
  it("gets the empty row of English in each translated field, and nothing is taken away", () => {
    const conversion = conversionOf(OLD_BARE)
    expect(Object.keys(conversion.set).sort()).toEqual(["boxFront", "cover", "description", "logo", "names", "rules", "tagline"])
    for (const rows of Object.values(conversion.set)) expect((rows as unknown[]).length).toBe(1)
    expect(conversion.unset).toEqual([])
  })

  it("is converted from empty values as from none: an empty text and an empty link are nothing", () => {
    const conversion = conversionOf(changed(OLD_BARE, { description: "", tagline: "", rulesFr: "", rulesEn: null }))
    expect(conversion.set.description).toEqual([row("Description", "en")])
    expect(conversion.set.rules).toEqual([row("Url", "en")])
    expect(conversion.unset).toEqual(["rulesEn", "rulesFr"])
  })

  it("keeps a blank text as the text it is: nothing is dropped", () => {
    expect(conversionOf(changed(OLD_BARE, { description: "   " })).set.description).toEqual([row("Description", "en", "   ")])
  })
})

describe("a category and an expansion", () => {
  it("get the names, and nothing else: a category's name is the English one", () => {
    const conversion = conversionOf(OLD_CATEGORY)
    expect(conversion.set).toEqual({ names: [row("LocalizedName", "en")] })
    expect(conversion.unset).toEqual([])
  })

  it("get their description, their cover and their box converted as a game's", () => {
    const conversion = conversionOf(changed(OLD_EXPANSION, { cover: picture("expansion-cover"), rulesDe: "https://example.com/de.pdf" }))
    expect(Object.keys(conversion.set).sort()).toEqual(["boxFront", "cover", "description", "names", "rules"])
    expect(conversion.set.description).toEqual([row("Description", "en", "New characters take a seat at the Queen's table.")])
    expect(conversion.set.cover).toEqual([row("Image", "en", picture("expansion-cover"))])
    expect(conversion.set.rules).toEqual([row("Url", "de", "https://example.com/de.pdf")].flatMap((german) => [row("Url", "en"), german]))
    expect(conversion.unset).toEqual(["rulesDe"])
  })
})

describe("the dataset", () => {
  const plan = planTranslations(all)

  it("is converted wherever a document stands, published or draft, and the others are not looked at", () => {
    expect(plan.problems).toEqual([])
    expect(plan.conversions.map((conversion) => [conversion.id, conversion.state])).toEqual([
      ["game-hanabi", "published"],
      ["game-bare", "published"],
      ["category-cooperation", "published"],
      ["expansion-courtisans-diplomats-confidants", "published"],
      ["drafts.expansion-courtisans-diplomats-confidants", "draft"],
    ])
    expect(plan.found).toEqual({ game: { published: 2, drafts: 0 }, expansion: { published: 1, drafts: 1 }, category: { published: 1, drafts: 0 } })
  })

  it("converts a draft as it does a published document, with the name the owner is editing", () => {
    const draft = plan.conversions.find((conversion) => conversion.state === "draft")
    expect(draft?.rev).toBe("rev-expansion-draft")
    expect(draft?.set.description).toEqual([row("Description", "en", "New characters take a seat at the Queen's table.")])
  })

  it("is one transaction with a patch for each document, the draft apart", () => {
    const mutations = mutationsOf(plan)
    expect(mutations).toHaveLength(5)
    expect(mutations.map((mutation) => mutation.patch.id)).toContain("drafts.expansion-courtisans-diplomats-confidants")
  })

  it("counts what it leaves alone", () => {
    const converted = new MemoryDataset(all)
    return migrate(converted, { apply: true }).then(() => {
      expect(planTranslations([...converted.docs.values()]).unchanged).toBe(5)
    })
  })
})

describe("a document that has what it needs", () => {
  const done = (doc: Doc) => applied(doc, conversionOf(doc))

  it("is left alone, and so are the documents of other types", () => {
    const plan = planTranslations([done(OLD_HANABI), done(OLD_CATEGORY), ...OTHERS])
    expect(plan.conversions).toEqual([])
    expect(plan.unchanged).toBe(2)
    expect(plan.problems).toEqual([])
  })

  it("keeps the rows the Studio wrote: their keys, their order, a language of its own, a picture of another language", () => {
    const rows = [studioRow("Description", "en", "English", "a1"), studioRow("Description", "ja", "日本語", "b2"), studioRow("Description", "fr", "Français", "c3")]
    const doc = changed(done(OLD_HANABI), { description: rows })
    expect(planTranslations([doc]).conversions).toEqual([])
  })

  it("puts the missing row of English first in a field that has rows of other languages, and keeps theirs", () => {
    const doc = changed(done(OLD_HANABI), { description: [studioRow("Description", "ja", "日本語", "b2"), studioRow("Description", "fr", "Français", "c3")] })
    const conversion = conversionOf(doc)
    expect(conversion.set.description).toEqual([row("Description", "en"), studioRow("Description", "ja", "日本語", "b2"), studioRow("Description", "fr", "Français", "c3")])
    expect(Object.keys(conversion.set)).toEqual(["description"])
    expect(conversion.notes).toEqual([["description", "no English row → an empty one", "no English row → an empty one"]])
  })

  it("is converted for what is old in it only: a game with its text in rows and its rules in the old fields", () => {
    const doc = changed(done(OLD_HANABI), { rulesFr: "https://example.com/hanabi-fr.pdf" })
    const conversion = conversionOf(doc)
    expect(conversion.unset).toEqual(["rulesFr"])
    expect(Object.keys(conversion.set)).toEqual(["rules"])
    expect(conversion.set.rules).toEqual([row("Url", "en", "https://example.com/hanabi-en.pdf"), row("Url", "fr", "https://example.com/hanabi-fr.pdf")])
  })
})

describe("the links to the rules", () => {
  it("become rows in the order of the platform's languages, whatever the order of the old fields", () => {
    const doc = changed(OLD_BARE, { rulesDe: "https://example.com/de.pdf", rulesEs: "https://example.com/es.pdf", rulesFr: "https://example.com/fr.pdf" })
    expect(conversionOf(doc).set.rules).toEqual([row("Url", "en"), row("Url", "fr", "https://example.com/fr.pdf"), row("Url", "es", "https://example.com/es.pdf"), row("Url", "de", "https://example.com/de.pdf")])
  })

  it("join the rows rules has, a row that is empty taking the link of its language and the same link being the same", () => {
    const doc = changed(OLD_BARE, { rules: [studioRow("Url", "en", "https://example.com/en.pdf"), studioRow("Url", "fr")], rulesEn: "https://example.com/en.pdf", rulesFr: "https://example.com/fr.pdf", rulesEs: "https://example.com/es.pdf" })
    const rules = conversionOf(doc).set.rules as { language: string; value?: string }[]
    expect(rules.map((entry) => [entry.language, entry.value])).toEqual([["en", "https://example.com/en.pdf"], ["fr", "https://example.com/fr.pdf"], ["es", "https://example.com/es.pdf"]])
  })
})

describe("what it will not convert", () => {
  const problemsOf = (...docs: Doc[]) => planTranslations(docs).problems

  it("is two links for one language: a row of rules and the old field of its language that differ", () => {
    const doc = changed(OLD_BARE, { rules: [studioRow("Url", "fr", "https://example.com/new.pdf")], rulesFr: "https://example.com/old.pdf" })
    expect(problemsOf(doc)).toEqual(['game-bare: rulesFr is "https://example.com/old.pdf" and the row of fr in rules is "https://example.com/new.pdf": it holds two links for one language, settle it in the Studio'])
  })

  it("is a document in a release: its state is not guessed at", () => {
    expect(problemsOf(changed(OLD_HANABI, { _id: "versions.rSummer.game-hanabi" }))).toEqual(["versions.rSummer.game-hanabi: it is a version in a release: the migration converts published documents and drafts only. Publish or discard it first"])
  })

  it("is a row of a language the platform does not have, a language twice, a row with no language or no key", () => {
    expect(problemsOf(changed(OLD_BARE, { tagline: [studioRow("String", "it", "Ciao")] }))).toEqual(['game-bare: tagline: "it" is not a language of the platform'])
    expect(problemsOf(changed(OLD_BARE, { tagline: [studioRow("String", "en", "A"), studioRow("String", "en", "B", "again")] }))).toEqual(["game-bare: tagline: There can only be one row per language"])
    expect(problemsOf(changed(OLD_BARE, { tagline: [{ _key: "x", value: "old format" }] }))).toEqual(["game-bare: tagline: A row has no language"])
    expect(problemsOf(changed(OLD_BARE, { tagline: [{ language: "en", value: "no key" }] }))).toEqual(['game-bare: tagline: a row has no _key ({"language":"en","value":"no key"})'])
  })

  it("is a value that is neither rows nor what the field held: a number for a text, a text for a picture", () => {
    expect(problemsOf(changed(OLD_BARE, { description: 12 }))).toEqual(["game-bare: description: it holds 12, which is not rows of a language, nor a text, what it held before"])
    expect(problemsOf(changed(OLD_BARE, { logo: "logo.png" }))).toEqual(['game-bare: logo: it holds "logo.png", which is not rows of a language, nor a picture, what it held before'])
  })

  it("is a name or a rules field that holds a plain value: they held none before", () => {
    expect(problemsOf(changed(OLD_BARE, { names: "Barre" }))).toEqual(['game-bare: names: it holds "Barre", which is not rows of a language'])
    expect(problemsOf(changed(OLD_BARE, { rules: "https://example.com/en.pdf" }))).toEqual(['game-bare: rules: it holds "https://example.com/en.pdf", which is not rows of a language'])
  })

  it("is an old link that is not a text", () => {
    expect(problemsOf(changed(OLD_BARE, { rulesFr: { url: "x" } }))).toEqual(['game-bare: rulesFr holds {"url":"x"}, which is not a link'])
  })

  it("is said all at once, with a document that can be converted left out of the problems", () => {
    const plan = planTranslations([changed(OLD_BARE, { description: 12 }), changed(OLD_HANABI, { logo: "x", _id: "game-other" }), OLD_CATEGORY])
    expect(plan.problems).toHaveLength(2)
    expect(plan.conversions.map((conversion) => conversion.id)).toEqual(["category-cooperation"])
  })
})

describe("the run", () => {
  it("writes nothing for a dry run, and says what it would do", async () => {
    const dataset = new MemoryDataset(all)
    const outcome = await migrate(dataset, { apply: false })
    expect(outcome.mode).toBe("dry-run")
    expect(outcome.plan.conversions).toHaveLength(5)
    expect(dataset.commits).toEqual([])
  })

  it("writes the plan in one transaction, then reads the dataset back and finds it as planned", async () => {
    const dataset = new MemoryDataset(all)
    const outcome = await migrate(dataset, { apply: true })
    expect(outcome.mode).toBe("applied")
    expect(outcome.afterProblems).toEqual([])
    expect(dataset.commits).toHaveLength(1)
    expect(dataset.commits[0]).toHaveLength(5)
    expect(dataset.docs.get("game-hanabi")?.rulesFr).toBeUndefined()
    expect((dataset.docs.get("game-hanabi")?.logo as { language: string }[]).map((entry) => entry.language)).toEqual(["en"])
    // published documents and drafts are patched where they are: no draft appears, no published document is made of a draft
    expect([...dataset.docs.keys()].sort()).toEqual([...all.map((doc) => doc._id)].sort())
  })

  it("does nothing the second time", async () => {
    const dataset = new MemoryDataset(all)
    await migrate(dataset, { apply: true })
    const again = await migrate(dataset, { apply: true })
    expect(again.mode).toBe("stopped")
    expect(again.plan.conversions).toEqual([])
    expect(dataset.commits).toHaveLength(1)
  })

  it("writes nothing when there is a problem to settle, though other documents could be converted", async () => {
    const dataset = new MemoryDataset([...all, changed(OLD_BARE, { _id: "game-odd", description: 12 })])
    const outcome = await migrate(dataset, { apply: true })
    expect(outcome.mode).toBe("stopped")
    expect(outcome.plan.problems).toHaveLength(1)
    expect(dataset.commits).toEqual([])
  })

  it("writes nothing when a document was saved since it was read: the transaction is refused whole", async () => {
    const dataset = new MemoryDataset(all)
    const read = dataset.documents.bind(dataset)
    let first = true
    // the owner saves the category in the Studio between the read and the write
    dataset.documents = async () => {
      const docs = await read()
      if (first) {
        first = false
        queueMicrotask(() => dataset.saved("category-cooperation", { color: "#112233" }))
      }
      return docs
    }
    await expect(migrate(dataset, { apply: true })).rejects.toThrow('Document "category-cooperation" has revision')
    expect(dataset.docs.get("game-hanabi")?.rulesFr).toBe("https://example.com/hanabi-fr.pdf")
    expect(dataset.docs.get("game-hanabi")?.logo).toEqual(OLD_HANABI.logo)
  })

  it("refuses to patch a document it has no revision of", async () => {
    const { _rev: _dropped, ...withoutRevision } = OLD_HANABI
    const outcome = await migrate(new MemoryDataset([withoutRevision as Doc]), { apply: true })
    expect(outcome.mode).toBe("stopped")
    expect(outcome.plan.problems).toEqual(["game-hanabi: it has no revision, which the dataset always sends: refusing to patch it unguarded"])
  })

  it("says it when what it reads back is not what it wrote", async () => {
    const dataset = new MemoryDataset(all)
    const commit = dataset.commit.bind(dataset)
    // a dataset that drops a field of one patch
    dataset.commit = async (mutations) => commit(mutations.map((mutation) => (mutation.patch.id === "game-hanabi" ? { patch: { ...mutation.patch, set: { ...mutation.patch.set, logo: undefined } } } : mutation)))
    const outcome = await migrate(dataset, { apply: true })
    expect(outcome.afterProblems.some((problem) => problem.includes("game-hanabi.logo is not what the plan said"))).toBe(true)
  })
})

describe("the plan in words", () => {
  const words = { projectId: "mhgqs6fe", dataset: "production" }

  it("says what was looked at, what changes field by field and how, and that nothing was written", () => {
    const text = describePlan(planTranslations(all), { ...words, mode: "dry-run" })
    expect(text).toContain("Translated fields (PLT-104) on mhgqs6fe/production: DRY RUN, nothing is written")
    expect(text).toContain("game       2 published documents, 0 drafts")
    expect(text).toContain("expansion  1 published document, 1 draft")
    expect(text).toContain("5 documents to convert, 0 already as they should be.")
    expect(text).toMatch(/game\.description {2}a text → English +1/)
    expect(text).toMatch(/game\.tagline {2}nothing → an empty English row +2/)
    expect(text).toMatch(/game\.rules {2}the old links → rows +1/)
    expect(text).toContain("Taken away, once their links are rows of rules: rulesEn, rulesFr.")
    expect(text).toContain("Links to the rules, by language: en 1, fr 1.")
    expect(text).toContain("Nothing was written. Run again with --apply")
  })

  it("says the document one by one when it is asked to", () => {
    const text = describePlan(planTranslations(all), { ...words, mode: "dry-run", verbose: true })
    expect(text).toContain("game-hanabi  (game, published, revision rev-hanabi)")
    expect(text).toContain("  rules: rulesEn, rulesFr → en, fr")
    expect(text).toContain("  unset: rulesEn, rulesFr")
    expect(text).toContain("drafts.expansion-courtisans-diplomats-confidants  (expansion, draft, revision rev-expansion-draft)")
  })

  it("prints the patch of one document as it would be sent, and says so when that is not a document to convert", () => {
    const text = describePlan(planTranslations(all), { ...words, mode: "dry-run", show: "category-cooperation" })
    expect(text).toContain("The patch of category-cooperation, as it is sent:")
    const patch = /as it is sent:\n([\s\S]*?\n {2}\})/.exec(text)?.[1] ?? ""
    expect(JSON.parse(patch)).toEqual({ patch: { id: "category-cooperation", ifRevisionID: "rev-category", set: { names: [row("LocalizedName", "en")] } } })
    expect(describePlan(planTranslations(all), { ...words, mode: "dry-run", show: "game-nothing" })).toContain("game-nothing is not a document to convert.")
  })

  it("says where the documents came from when it is not the dataset", () => {
    expect(describePlan(planTranslations(all), { ...words, mode: "dry-run", source: "backup.ndjson" })).toContain("Read from backup.ndjson, not from the dataset.")
  })

  it("lists what stops it, and writes no promise", () => {
    const text = describePlan(planTranslations([changed(OLD_BARE, { description: 12 })]), { ...words, mode: "stopped" })
    expect(text).toContain(": NOTHING WRITTEN")
    expect(text).toContain("Nothing can be converted until this is settled:")
    expect(text).toContain("game-bare: description: it holds 12")
    expect(text).not.toContain("Run again with --apply")
  })

  it("says there is nothing to convert, and that it wrote the transaction once it has", () => {
    expect(describePlan(planTranslations([]), { ...words, mode: "dry-run" })).toContain("Nothing to convert.")
    expect(describePlan(planTranslations(all), { ...words, mode: "applied" })).toContain("Written in one transaction, then read back.")
  })
})
