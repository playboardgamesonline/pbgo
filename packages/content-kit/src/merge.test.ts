import { describe, expect, it } from "vitest"
import { deepEqual, hasEffect, mergeFill } from "./merge.ts"

const fill = { overwrite: false }
const overwrite = { overwrite: true }

describe("deepEqual", () => {
  it("compares structures whatever the order of the keys", () => {
    expect(deepEqual({ a: 1, b: { c: [1, 2], d: "x" } }, { b: { d: "x", c: [1, 2] }, a: 1 })).toBe(true)
  })

  it("tells different values apart", () => {
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false)
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false)
    expect(deepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false)
    expect(deepEqual("1", 1)).toBe(false)
    expect(deepEqual(null, undefined)).toBe(false)
  })

  it("keeps the order of an array", () => {
    expect(deepEqual([1, 2], [1, 2])).toBe(true)
    expect(deepEqual([1, 2], [2, 1])).toBe(false)
    expect(deepEqual([1], [1, 2])).toBe(false)
  })

  it("does not take an array for an object", () => {
    expect(deepEqual([], {})).toBe(false)
    expect(deepEqual({ 0: "a" }, ["a"])).toBe(false)
  })
})

describe("hasEffect", () => {
  it("is true when a value is filled or replaced", () => {
    expect(hasEffect([{ kind: "fill", path: "a" }])).toBe(true)
    expect(hasEffect([{ kind: "overwrite", path: "a", seed: 1, current: 2 }])).toBe(true)
  })

  it("is false when nothing changes, or when a value is only reported", () => {
    expect(hasEffect([])).toBe(false)
    expect(hasEffect([{ kind: "diverged", path: "a", seed: 1, current: 2 }])).toBe(false)
  })

  it("is true as soon as one change has an effect", () => {
    expect(hasEffect([{ kind: "diverged", path: "a", seed: 1, current: 2 }, { kind: "fill", path: "b" }])).toBe(true)
  })
})

describe("mergeFill", () => {
  describe("empty values", () => {
    it.each([undefined, null, "", "   ", []])("takes the seed value when Sanity holds %j", (empty) => {
      expect(mergeFill("title", empty, "title", fill)).toEqual({ value: "title", changes: [{ kind: "fill", path: "title" }] })
    })

    it.each([undefined, null, "", "   ", []])("leaves Sanity alone when the seed holds %j", (empty) => {
      expect(mergeFill(empty, "kept", "title", fill)).toEqual({ value: "kept", changes: [] })
    })

    it("does not count 0 and false as empty", () => {
      expect(mergeFill(5, 0, "n", fill).changes).toEqual([{ kind: "diverged", path: "n", seed: 5, current: 0 }])
      expect(mergeFill(0, 5, "n", fill).changes).toEqual([{ kind: "diverged", path: "n", seed: 0, current: 5 }])
      expect(mergeFill(true, false, "flag", fill).changes).toEqual([{ kind: "diverged", path: "flag", seed: true, current: false }])
      expect(mergeFill(0, undefined, "n", fill)).toEqual({ value: 0, changes: [{ kind: "fill", path: "n" }] })
    })
  })

  describe("scalars", () => {
    it("reports nothing when both sides agree", () => {
      expect(mergeFill("same", "same", "a", fill)).toEqual({ value: "same", changes: [] })
      expect(mergeFill(3, 3, "a", overwrite)).toEqual({ value: 3, changes: [] })
    })

    it("keeps what Sanity holds and reports the difference", () => {
      expect(mergeFill("seed", "edited", "a", fill)).toEqual({
        value: "edited",
        changes: [{ kind: "diverged", path: "a", seed: "seed", current: "edited" }],
      })
    })

    it("replaces it when asked to", () => {
      expect(mergeFill("seed", "edited", "a", overwrite)).toEqual({
        value: "seed",
        changes: [{ kind: "overwrite", path: "a", seed: "seed", current: "edited" }],
      })
    })

    it("keeps Sanity's value when the two sides are not of the same kind", () => {
      expect(mergeFill({ a: 1 }, "text", "x", fill).changes).toEqual([{ kind: "diverged", path: "x", seed: { a: 1 }, current: "text" }])
      expect(mergeFill("text", { a: 1 }, "x", fill).changes).toEqual([{ kind: "diverged", path: "x", seed: "text", current: { a: 1 } }])
      expect(mergeFill([1], { a: 1 }, "x", fill).changes).toHaveLength(1)
    })
  })

  describe("objects", () => {
    it("merges key by key and adds the missing ones", () => {
      const result = mergeFill({ fr: "Bleu", en: "Blue" }, { fr: "Bleu" }, "name", fill)
      expect(result.value).toEqual({ fr: "Bleu", en: "Blue" })
      expect(result.changes).toEqual([{ kind: "fill", path: "name.en" }])
    })

    it("keeps what only Sanity has (a crop, a hotspot, a language added later)", () => {
      const base = { _type: "image", asset: { _ref: "image-a" }, hotspot: { x: 0.5 } }
      const result = mergeFill({ _type: "image", asset: { _ref: "image-a" } }, base, "image", fill)
      expect(result.value).toBe(base)
      expect(result.changes).toEqual([])

      const filled = mergeFill({ a: 1, b: 2 }, { a: 1, extra: "x" }, "", fill)
      expect(filled.value).toEqual({ a: 1, b: 2, extra: "x" })
      expect(filled.changes).toEqual([{ kind: "fill", path: "b" }])
    })

    it("goes as deep as needed and names the path", () => {
      const result = mergeFill({ a: { b: { c: "seed", d: "new" } } }, { a: { b: { c: "edited" } } }, "root", fill)
      expect(result.value).toEqual({ a: { b: { c: "edited", d: "new" } } })
      expect(result.changes).toEqual([
        { kind: "diverged", path: "root.a.b.c", seed: "seed", current: "edited" },
        { kind: "fill", path: "root.a.b.d" },
      ])
    })

    it("hands back the same object when nothing changed", () => {
      const base = { a: 1, b: { c: 2 } }
      expect(mergeFill({ a: 1, b: { c: 2 } }, base, "x", fill).value).toBe(base)
    })

    it("leaves the content as it was when a difference is only reported", () => {
      const base = { a: 1, b: { c: 2 } }
      const result = mergeFill({ a: 9 }, base, "x", fill)
      expect(result.value).toEqual({ a: 1, b: { c: 2 } })
      expect(hasEffect(result.changes)).toBe(false)
    })

    it("replaces a differing leaf in an object with overwrite, and only that one", () => {
      const result = mergeFill({ fr: "Nouveau", en: "Same" }, { fr: "Ancien", en: "Same", de: "Alt" }, "title", overwrite)
      expect(result.value).toEqual({ fr: "Nouveau", en: "Same", de: "Alt" })
      expect(result.changes).toEqual([{ kind: "overwrite", path: "title.fr", seed: "Nouveau", current: "Ancien" }])
    })
  })

  describe("arrays of keyed items", () => {
    const item = (key: string, extra: Record<string, unknown> = {}) => ({ _key: key, _type: "step", ...extra })

    it("merges the items by _key, not by position", () => {
      const seed = [item("a", { title: "A" }), item("b", { title: "B" })]
      const base = [item("b", { title: "B" }), item("a", { title: "A" })]
      const result = mergeFill(seed, base, "steps", fill)
      expect(result.changes).toEqual([])
      expect(result.value).toBe(base)
    })

    it("fills a gap inside an item and names it with its key", () => {
      const seed = [item("a", { title: "A", note: "n" })]
      const base = [item("a", { title: "A" })]
      const result = mergeFill(seed, base, "steps", fill)
      expect(result.value).toEqual([item("a", { title: "A", note: "n" })])
      expect(result.changes).toEqual([{ kind: "fill", path: 'steps[_key=="a"].note' }])
    })

    it("inserts a missing item after the seed item that precedes it", () => {
      const seed = [item("a"), item("b"), item("c")]
      const result = mergeFill(seed, [item("a"), item("c")], "steps", fill)
      expect((result.value as { _key: string }[]).map((entry) => entry._key)).toEqual(["a", "b", "c"])
      expect(result.changes).toEqual([{ kind: "fill", path: 'steps[_key=="b"]' }])
    })

    it("puts a missing first item first", () => {
      const result = mergeFill([item("a"), item("b")], [item("b")], "steps", fill)
      expect((result.value as { _key: string }[]).map((entry) => entry._key)).toEqual(["a", "b"])
    })

    it("rebuilds a run of missing items in order", () => {
      const result = mergeFill([item("a"), item("b"), item("c")], [item("c")], "steps", fill)
      expect((result.value as { _key: string }[]).map((entry) => entry._key)).toEqual(["a", "b", "c"])
      expect(result.changes).toHaveLength(2)
    })

    it("keeps the items only Sanity has, where they are", () => {
      const result = mergeFill([item("a"), item("b")], [item("extra"), item("a")], "steps", fill)
      expect((result.value as { _key: string }[]).map((entry) => entry._key)).toEqual(["extra", "a", "b"])
    })

    it("keeps a reordering done in the Studio", () => {
      const base = [item("c"), item("b"), item("a")]
      const result = mergeFill([item("a"), item("b"), item("c")], base, "steps", fill)
      expect(result.value).toBe(base)
      expect(result.changes).toEqual([])
    })

    it("reports an edited value inside an item without touching it", () => {
      const result = mergeFill([item("a", { title: "Seed" })], [item("a", { title: "Edited" })], "steps", fill)
      expect(result.value).toEqual([item("a", { title: "Edited" })])
      expect(result.changes).toEqual([{ kind: "diverged", path: 'steps[_key=="a"].title', seed: "Seed", current: "Edited" }])
    })

    it("replaces the edited value inside an item with overwrite", () => {
      const result = mergeFill([item("a", { title: "Seed" })], [item("a", { title: "Edited" })], "steps", overwrite)
      expect(result.value).toEqual([item("a", { title: "Seed" })])
      expect(result.changes).toEqual([{ kind: "overwrite", path: 'steps[_key=="a"].title', seed: "Seed", current: "Edited" }])
    })

    it("fills a list Sanity does not have yet as a whole", () => {
      const seed = [item("a"), item("b")]
      expect(mergeFill(seed, undefined, "steps", fill)).toEqual({ value: seed, changes: [{ kind: "fill", path: "steps" }] })
      expect(mergeFill(seed, [], "steps", fill)).toEqual({ value: seed, changes: [{ kind: "fill", path: "steps" }] })
    })
  })

  describe("the rows of a translated field", () => {
    // `{ _key, _type, language, value }`, a row per language: the Studio makes up the key of a row it adds
    const row = (language: string, value?: unknown, key: string = language) => ({ _key: key, _type: "internationalizedArrayTextValue", language, ...(value === undefined ? {} : { value }) })
    const languages = (result: { value: unknown }) => (result.value as { language: string }[]).map((entry) => entry.language)

    it("are the same row when they hold the same language, whatever their key", () => {
      const base = [row("en", "A", "k1")]
      const result = mergeFill([row("en", "A")], base, "description", fill)
      expect(result.changes).toEqual([])
      expect(result.value).toBe(base)
    })

    it("fill the value of a row the Studio keeps empty (the row of English that every field has), under the key the Studio gave it", () => {
      const result = mergeFill([row("en", "A")], [row("en", undefined, "k1")], "description", fill)
      expect(result.value).toEqual([row("en", "A", "k1")])
      expect(result.changes).toEqual([{ kind: "fill", path: 'description[_key=="k1"].value' }])
    })

    it("report an edited value without touching it, and name the row by the key it has", () => {
      const result = mergeFill([row("en", "Seed")], [row("en", "Edited", "k1")], "description", fill)
      expect(result.value).toEqual([row("en", "Edited", "k1")])
      expect(result.changes).toEqual([{ kind: "diverged", path: 'description[_key=="k1"].value', seed: "Seed", current: "Edited" }])
    })

    it("replace an edited value with overwrite, and keep the key of the Studio", () => {
      const result = mergeFill([row("en", "Seed")], [row("en", "Edited", "k1")], "description", overwrite)
      expect(result.value).toEqual([row("en", "Seed", "k1")])
    })

    it("add a language the field does not have yet after the language that precedes it, wherever the keys are the Studio's", () => {
      const result = mergeFill([row("en", "A"), row("fr", "B"), row("es", "C")], [row("en", "A", "k1"), row("es", "C", "k2")], "description", fill)
      expect(languages(result)).toEqual(["en", "fr", "es"])
      expect(result.changes).toEqual([{ kind: "fill", path: 'description[_key=="fr"]' }])
      expect(result.value).toEqual([row("en", "A", "k1"), row("fr", "B"), row("es", "C", "k2")])
    })

    it("keep a language only Sanity has, and a row added in the Studio", () => {
      const result = mergeFill([row("en", "A")], [row("en", "A", "k1"), row("ja", "日本語", "k2")], "description", fill)
      expect(result.changes).toEqual([])
      expect(languages(result)).toEqual(["en", "ja"])
    })

    it("are not matched by language across types: a row of a text is not the row of a picture", () => {
      const picture = { _key: "k1", _type: "internationalizedArrayImageValue", language: "en", value: { _type: "image" } }
      const result = mergeFill([row("en", "A")], [picture], "description", fill)
      expect(result.changes).toEqual([{ kind: "fill", path: 'description[_key=="en"]' }])
    })

    it("are the only items found by something else than their key: an item that has a language is not a row", () => {
      const step = (key: string, language: string, title: string) => ({ _key: key, _type: "step", language, title })
      const result = mergeFill([step("a", "en", "A")], [step("b", "en", "B")], "steps", fill)
      expect(result.changes).toEqual([{ kind: "fill", path: 'steps[_key=="a"]' }])
      expect(result.value).toEqual([step("a", "en", "A"), step("b", "en", "B")])
    })
  })

  describe("arrays without keys", () => {
    it("compares them as a whole", () => {
      expect(mergeFill(["a", "b"], ["a", "b"], "tags", fill).changes).toEqual([])
      expect(mergeFill(["a", "b"], ["b", "a"], "tags", fill).changes).toEqual([{ kind: "diverged", path: "tags", seed: ["a", "b"], current: ["b", "a"] }])
      expect(mergeFill(["a"], ["b"], "tags", overwrite).value).toEqual(["a"])
    })
  })

  it("never modifies its arguments", () => {
    const seed = { list: [{ _key: "a", t: 1 }, { _key: "b", t: 2 }], name: { fr: "x", en: "y" } }
    const base = { list: [{ _key: "a" }], name: { fr: "z" } }
    const seedCopy = structuredClone(seed)
    const baseCopy = structuredClone(base)
    mergeFill(seed, base, "doc", overwrite)
    expect(seed).toEqual(seedCopy)
    expect(base).toEqual(baseCopy)
  })
})
