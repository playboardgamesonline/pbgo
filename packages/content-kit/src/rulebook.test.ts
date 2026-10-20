import { join } from "node:path"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { LANGUAGE_IDS } from "./locale.ts"
import type { LanguageId } from "./locale.ts"
import { MemoryStore } from "./memory-store.ts"
import {
  DEFAULT_RULEBOOK_LANGUAGE,
  RulebookError,
  cleanPath,
  expectedFileAssetId,
  fileRef,
  formatRulebookList,
  formatRulebookReport,
  formatSize,
  loadRulebook,
  loadRulebooks,
  parseRulebookArg,
  parseRulebookArgs,
  placeRulebooks,
  rulebookDoc,
  rulebookField,
  rulebookTitle,
} from "./rulebook.ts"
import type { Rulebook, RulebookResult } from "./rulebook.ts"
import { problemsOf } from "./schema-check.ts"
import type { FieldDef, Types } from "./schema-check.ts"
import { TempFolders } from "./test-fixtures.ts"
import type { StoredDoc } from "./types.ts"

const temp = new TempFolders()
afterEach(() => temp.cleanUp())

/** A file that starts like a PDF. Two texts give two different files, so two different content hashes. */
const pdf = (text = "rules") => Buffer.from(`%PDF-1.4\n% ${text}\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`)

const HOME = "/home/ore"

/** A rulebook that was read, without touching the disk. */
function rulebookOf(language: LanguageId, text: string = language): Rulebook {
  const data = pdf(text)
  return { language, field: rulebookField(language), path: `/rules/${text}.pdf`, filename: `${text}.pdf`, data, sha1: sha1Of(data) }
}

import { createHash } from "node:crypto"
const sha1Of = (data: Buffer) => createHash("sha1").update(data).digest("hex")

const settingsDraft = (store: MemoryStore) => store.docs.get("drafts.settings") as (StoredDoc & Record<string, unknown>) | undefined

const place = (store: MemoryStore, rulebooks: Rulebook[], options: { apply?: boolean; overwrite?: boolean } = {}) =>
  placeRulebooks({ store, rulebooks, apply: options.apply ?? true, overwrite: options.overwrite })

describe("the studio schema", () => {
  let fields: FieldDef[]
  let types: Types

  beforeAll(async () => {
    // the shared Studio schemas, imported from a computed specifier so that typechecking the kit does not follow them into Sanity's DOM types
    const specifier = "@pbgo/studio-kit"
    const kit = (await import(/* @vite-ignore */ specifier)) as { settings: { name: string; fields: FieldDef[] } }
    fields = kit.settings.fields
    types = new Map()
  }, 60_000)

  const fieldOf = (name: string) => {
    const found = fields.find((field) => field.name === name)
    if (!found) throw new Error(`The settings type has no field "${name}"`)
    return found
  }

  it.each(LANGUAGE_IDS)("has the %s rulebook file field the kit writes, titled as the report calls it", (language) => {
    const field = fieldOf(rulebookField(language))
    expect(field.type).toBe("file")
    expect((field as { title?: string }).title).toBe(rulebookTitle(language))
    expect((field as { options?: { accept?: string } }).options?.accept).toBe("application/pdf")
  })

  it.each(LANGUAGE_IDS)("takes the file field of %s next to its link field, which the site reads", async (language) => {
    const specifier = "@pbgo/core/lib/settings"
    const core = (await import(/* @vite-ignore */ specifier)) as { RULES_FIELD: Record<string, string> }
    // the site opens the file of a language when there is one, else its link: the two fields are a pair
    expect(rulebookField(language)).toBe(`${core.RULES_FIELD[language]}File`)
    expect(fieldOf(core.RULES_FIELD[language] as string).type).toBe("url")
  })

  it.each(LANGUAGE_IDS)("accepts the reference written for %s", (language) => {
    const field = fieldOf(rulebookField(language))
    expect(problemsOf(fileRef(expectedFileAssetId("a".repeat(40))), field, `settings.${field.name}`, types)).toEqual([])
  })
})

describe("formatSize", () => {
  it.each([
    [1, "1 KB"],
    [1000, "1 KB"],
    [640 * 1024, "640 KB"],
    [1024 * 1024, "1.0 MB"],
    [Math.round(1.9 * 1024 * 1024), "1.9 MB"],
    [50 * 1024 * 1024, "50.0 MB"],
  ])("writes %i bytes as %s", (bytes, text) => {
    expect(formatSize(bytes)).toBe(text)
  })
})

describe("the field of a language", () => {
  it("is one file field per language, all different", () => {
    const names = LANGUAGE_IDS.map((language) => rulebookField(language))
    expect(new Set(names).size).toBe(LANGUAGE_IDS.length)
    expect(names.every((name) => /^rulesPdf(Fr|En|Es|De)File$/.test(name))).toBe(true)
  })

  it("is titled like the Studio field", () => {
    expect(rulebookTitle("fr")).toBe("Rules PDF (FR)")
    expect(rulebookTitle("de")).toBe("Rules PDF (DE)")
  })
})

describe("cleanPath", () => {
  it("leaves a plain path alone", () => {
    expect(cleanPath("./rules/regles.pdf", HOME)).toBe("./rules/regles.pdf")
  })

  it("takes the quotes off a path in quotes", () => {
    expect(cleanPath('"/Users/ore/My Rules.pdf"', HOME)).toBe("/Users/ore/My Rules.pdf")
    expect(cleanPath("'/Users/ore/My Rules.pdf'", HOME)).toBe("/Users/ore/My Rules.pdf")
  })

  it("understands the escaped spaces of a file dropped into a terminal", () => {
    expect(cleanPath("/Users/ore/My\\ Rules\\ (v2).pdf", HOME)).toBe("/Users/ore/My Rules (v2).pdf")
  })

  it("trims what surrounds the path", () => {
    expect(cleanPath("  /tmp/rules.pdf \n", HOME)).toBe("/tmp/rules.pdf")
  })

  it("expands ~ to the home folder, only at the start", () => {
    expect(cleanPath("~", HOME)).toBe(HOME)
    expect(cleanPath("~/Downloads/rules.pdf", HOME)).toBe(`${HOME}/Downloads/rules.pdf`)
    expect(cleanPath("./~/rules.pdf", HOME)).toBe("./~/rules.pdf")
    expect(cleanPath("~rules.pdf", HOME)).toBe("~rules.pdf")
  })

  it("expands ~ inside quotes too", () => {
    expect(cleanPath('"~/Downloads/My Rules.pdf"', HOME)).toBe(`${HOME}/Downloads/My Rules.pdf`)
  })

  it("keeps a lone quote, which is a name and not a pair", () => {
    expect(cleanPath("'", HOME)).toBe("'")
  })
})

describe("parseRulebookArg", () => {
  it("reads the language before the = sign", () => {
    expect(parseRulebookArg("fr=./regles.pdf")).toEqual({ language: "fr", path: "./regles.pdf" })
    expect(parseRulebookArg("DE=./Regeln.pdf")).toEqual({ language: "de", path: "./Regeln.pdf" })
  })

  it("takes a path alone as the default language, English", () => {
    expect(DEFAULT_RULEBOOK_LANGUAGE).toBe("en")
    expect(parseRulebookArg("./rules.pdf")).toEqual({ language: "en", path: "./rules.pdf" })
    expect(parseRulebookArg("/Users/ore/rules.pdf")).toEqual({ language: "en", path: "/Users/ore/rules.pdf" })
  })

  it("does not read a path that holds an = sign later on as a language", () => {
    expect(parseRulebookArg("./a=b.pdf")).toEqual({ language: "en", path: "./a=b.pdf" })
    expect(parseRulebookArg("/tmp/rules=2.pdf")).toEqual({ language: "en", path: "/tmp/rules=2.pdf" })
  })

  it("refuses a short word before the = sign that is not a language, and says how to name the file", () => {
    expect(() => parseRulebookArg("xx=./rules.pdf")).toThrow(RulebookError)
    expect(() => parseRulebookArg("xx=./rules.pdf")).toThrow(/"xx" is not a language of the site \(fr, en, es, de\)/)
    expect(() => parseRulebookArg("abc=final.pdf")).toThrow(/write \.\/abc=final\.pdf/)
  })

  it("reads a longer word before an = sign as the start of a file name, not as a language", () => {
    expect(parseRulebookArg("rules=final.pdf")).toEqual({ language: "en", path: "rules=final.pdf" })
  })

  it("refuses an empty value, with the form to use", () => {
    expect(() => parseRulebookArg("")).toThrow(/needs a file: --rules \[<language>=\]<file\.pdf>/)
    expect(() => parseRulebookArg("   ")).toThrow(RulebookError)
  })

  it("refuses a language with no file", () => {
    expect(() => parseRulebookArg("fr=")).toThrow(/The fr rulebook needs a file: --rules fr=<file\.pdf>/)
    expect(() => parseRulebookArg("fr=  ")).toThrow(RulebookError)
  })

  it("keeps the spaces and quotes of the path for loadRulebook to clean", () => {
    expect(parseRulebookArg("es='/Users/ore/Mis Reglas.pdf'")).toEqual({ language: "es", path: "'/Users/ore/Mis Reglas.pdf'" })
  })
})

describe("parseRulebookArgs", () => {
  it("reads one rulebook per language", () => {
    expect(parseRulebookArgs(["fr=./a.pdf", "en=./b.pdf", "./c.pdf".replace("./c", "es=./c")])).toEqual([
      { language: "fr", path: "./a.pdf" },
      { language: "en", path: "./b.pdf" },
      { language: "es", path: "./c.pdf" },
    ])
  })

  it("reads none as an empty list", () => {
    expect(parseRulebookArgs([])).toEqual([])
  })

  it("refuses two rulebooks for a language, naming both files", () => {
    expect(() => parseRulebookArgs(["./a.pdf", "./b.pdf"])).toThrow(/Two rulebooks for "en": \.\/a\.pdf and \.\/b\.pdf/)
    expect(() => parseRulebookArgs(["fr=./a.pdf", "FR=./b.pdf"])).toThrow(/Two rulebooks for "fr"/)
  })
})

describe("loadRulebook", () => {
  it("reads a PDF: its field, its name, its content and its hash", async () => {
    const data = pdf("regles")
    const dir = await temp.create({ "Regles.PDF": data })
    const rulebook = await loadRulebook({ language: "fr", path: "Regles.PDF" }, { cwd: dir })
    expect(rulebook).toEqual({ language: "fr", field: "rulesPdfFrFile", path: join(dir, "Regles.PDF"), filename: "Regles.pdf", data, sha1: sha1Of(data) })
  })

  it("resolves a relative path from the folder it is given, and takes an absolute path as it is", async () => {
    const dir = await temp.create({ "a.pdf": pdf("a") })
    const elsewhere = await temp.create({ "b.pdf": pdf("b") })
    expect((await loadRulebook({ language: "en", path: "a.pdf" }, { cwd: dir })).path).toBe(join(dir, "a.pdf"))
    expect((await loadRulebook({ language: "en", path: join(dir, "a.pdf") }, { cwd: elsewhere })).path).toBe(join(dir, "a.pdf"))
  })

  it("understands the path the way a terminal hands it over", async () => {
    const dir = await temp.create({ "My Rules (v2).pdf": pdf("v2") })
    const escaped = await loadRulebook({ language: "en", path: "My\\ Rules\\ (v2).pdf" }, { cwd: dir })
    const quoted = await loadRulebook({ language: "en", path: '"My Rules (v2).pdf"' }, { cwd: dir })
    expect(escaped.filename).toBe("My Rules (v2).pdf")
    expect(quoted.sha1).toBe(escaped.sha1)
  })

  it("names the file in Sanity with a lowercase .pdf, whatever it was called", async () => {
    const dir = await temp.create({ "RULES.PDF": pdf("upper"), "rules.final": pdf("ext"), ".hidden": pdf("dot") })
    expect((await loadRulebook({ language: "en", path: "RULES.PDF" }, { cwd: dir })).filename).toBe("RULES.pdf")
    expect((await loadRulebook({ language: "en", path: "rules.final" }, { cwd: dir })).filename).toBe("rules.pdf")
    expect((await loadRulebook({ language: "en", path: ".hidden" }, { cwd: dir })).filename).toBe("hidden.pdf")
  })

  it("accepts a PDF whose header follows a few bytes of junk", async () => {
    const dir = await temp.create({ "junk.pdf": Buffer.concat([Buffer.from("\n\n garbage \n"), pdf("late")]) })
    await expect(loadRulebook({ language: "en", path: "junk.pdf" }, { cwd: dir })).resolves.toMatchObject({ filename: "junk.pdf" })
  })

  it("refuses a file that is not there, and says where it looked", async () => {
    const dir = await temp.create()
    const attempt = loadRulebook({ language: "fr", path: "nope.pdf" }, { cwd: dir })
    await expect(attempt).rejects.toThrow(RulebookError)
    await expect(attempt).rejects.toThrow(`Rulebook fr: there is no file at ${join(dir, "nope.pdf")}`)
  })

  it("refuses a folder", async () => {
    const dir = await temp.create()
    await expect(loadRulebook({ language: "en", path: "." }, { cwd: dir })).rejects.toThrow(/Rulebook en: .* is not a file/)
  })

  it("refuses an empty file", async () => {
    const dir = await temp.create({ "empty.pdf": "" })
    await expect(loadRulebook({ language: "en", path: "empty.pdf" }, { cwd: dir })).rejects.toThrow(/Rulebook en: .*empty\.pdf is empty/)
  })

  it("refuses a file that is too big, with both sizes", async () => {
    const dir = await temp.create({ "big.pdf": Buffer.concat([pdf("big"), Buffer.alloc(3 * 1024 * 1024)]) })
    await expect(loadRulebook({ language: "en", path: "big.pdf" }, { cwd: dir, maxBytes: 2 * 1024 * 1024 })).rejects.toThrow(/weighs 3\.0 MB, more than the 2\.0 MB a rulebook may/)
  })

  it("takes a file of exactly the limit", async () => {
    const data = pdf("exact")
    const dir = await temp.create({ "exact.pdf": data })
    await expect(loadRulebook({ language: "en", path: "exact.pdf" }, { cwd: dir, maxBytes: data.length })).resolves.toMatchObject({ filename: "exact.pdf" })
  })

  it("refuses a file that is not a PDF, whatever its name says", async () => {
    const dir = await temp.create({ "rules.pdf": "These are the rules of the game, in plain text.", "rules.png": Buffer.from([0x89, 0x50, 0x4e, 0x47]) })
    await expect(loadRulebook({ language: "de", path: "rules.pdf" }, { cwd: dir })).rejects.toThrow(/Rulebook de: .*rules\.pdf is not a PDF \(it does not start with %PDF-\)/)
    await expect(loadRulebook({ language: "de", path: "rules.png" }, { cwd: dir })).rejects.toThrow(/is not a PDF/)
  })

  it("refuses a file whose PDF header is lost far into it", async () => {
    const dir = await temp.create({ "far.pdf": Buffer.concat([Buffer.alloc(2048, "x"), pdf("far")]) })
    await expect(loadRulebook({ language: "en", path: "far.pdf" }, { cwd: dir })).rejects.toThrow(/is not a PDF/)
  })
})

describe("loadRulebooks", () => {
  it("reads every rulebook, in the order asked", async () => {
    const dir = await temp.create({ "fr.pdf": pdf("fr"), "en.pdf": pdf("en") })
    const rulebooks = await loadRulebooks(parseRulebookArgs(["fr=fr.pdf", "en=en.pdf"]), { cwd: dir })
    expect(rulebooks.map((rulebook) => [rulebook.language, rulebook.field, rulebook.filename])).toEqual([
      ["fr", "rulesPdfFrFile", "fr.pdf"],
      ["en", "rulesPdfEnFile", "en.pdf"],
    ])
  })

  it("fails on a rulebook that cannot be used", async () => {
    const dir = await temp.create({ "fr.pdf": pdf("fr") })
    await expect(loadRulebooks(parseRulebookArgs(["fr=fr.pdf", "en=missing.pdf"]), { cwd: dir })).rejects.toThrow(/Rulebook en: there is no file at/)
  })

  it("says what is wrong with every rulebook that cannot be used, a line each, in the order asked", async () => {
    const dir = await temp.create({ "fr.pdf": pdf("fr"), "notes.txt": "hello" })
    const error = await loadRulebooks(parseRulebookArgs(["fr=missing.pdf", "en=fr.pdf", "es=notes.txt"]), { cwd: dir }).catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(RulebookError)
    const lines = (error as Error).message.split("\n")
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatch(/^Rulebook fr: there is no file at/)
    expect(lines[1]).toMatch(/^Rulebook es: .* is not a PDF/)
  })
})

describe("fileRef and rulebookDoc", () => {
  it("makes the value of a file field", () => {
    expect(fileRef("file-abc-pdf")).toEqual({ _type: "file", asset: { _type: "reference", _ref: "file-abc-pdf" } })
  })

  it("expects the asset id Sanity gives a PDF: the content hash and the extension", () => {
    expect(expectedFileAssetId("0123abcd")).toBe("file-0123abcd-pdf")
  })

  it("is the settings singleton with the file fields of the rulebooks and nothing else", () => {
    const fr = rulebookOf("fr")
    const en = rulebookOf("en")
    expect(rulebookDoc([fr, en], new Map([[fr.sha1, "file-real-pdf"]]))).toEqual({
      _id: "settings",
      _type: "settings",
      rulesPdfFrFile: fileRef("file-real-pdf"),
      rulesPdfEnFile: fileRef(expectedFileAssetId(en.sha1)),
    })
  })
})

describe("placeRulebooks · a dry run", () => {
  it("says what would happen and writes and uploads nothing", async () => {
    const store = new MemoryStore()
    const result = await place(store, [rulebookOf("fr"), rulebookOf("en")], { apply: false })
    expect(result).toMatchObject({ mode: "dry-run", action: "create", uploads: 2, written: 0 })
    expect(result.placements.map(({ rulebook, outcome, stored }) => [rulebook.language, outcome, stored])).toEqual([
      ["fr", "placed", false],
      ["en", "placed", false],
    ])
    expect(store.writes).toEqual([])
    expect(store.fileUploads).toEqual([])
    expect(store.docs.size).toBe(0)
  })

  it("does not count a file the dataset already holds as an upload", async () => {
    const store = new MemoryStore()
    const fr = rulebookOf("fr")
    store.fileAssets.set(fr.sha1, "file-known-pdf")
    const result = await place(store, [fr, rulebookOf("en")], { apply: false })
    expect(result.uploads).toBe(1)
    expect(result.placements[0]).toMatchObject({ outcome: "placed", stored: true })
    expect(store.fileUploads).toEqual([])
  })

  it("counts a file given for two languages once", async () => {
    const store = new MemoryStore()
    const same = pdf("same")
    const fr = { ...rulebookOf("fr", "same"), data: same, sha1: sha1Of(same) }
    const en = { ...rulebookOf("en", "same"), data: same, sha1: sha1Of(same) }
    expect((await place(store, [fr, en], { apply: false })).uploads).toBe(1)
  })

  it("refuses to run with no rulebook", async () => {
    await expect(place(new MemoryStore(), [])).rejects.toThrow(/No rulebook to place/)
  })

  it("refuses two rulebooks for a language", async () => {
    await expect(place(new MemoryStore(), [rulebookOf("fr", "a"), rulebookOf("fr", "b")])).rejects.toThrow(/Two rulebooks for "fr"/)
  })
})

describe("placeRulebooks · apply", () => {
  it("writes the rulebooks into a new draft of settings, in one transaction, and uploads each file", async () => {
    const store = new MemoryStore()
    const fr = rulebookOf("fr")
    const en = rulebookOf("en")
    const result = await place(store, [fr, en])
    expect(result).toMatchObject({ mode: "apply", action: "create", uploads: 2, written: 1 })
    expect(result.placements.map((placement) => placement.outcome)).toEqual(["placed", "placed"])
    expect(store.writes).toHaveLength(1)
    expect([...store.docs.keys()]).toEqual(["drafts.settings"])
    expect(settingsDraft(store)).toMatchObject({
      _id: "drafts.settings",
      _type: "settings",
      rulesPdfFrFile: fileRef(`file-${fr.sha1}-pdf`),
      rulesPdfEnFile: fileRef(`file-${en.sha1}-pdf`),
    })
    expect(store.fileUploads.map((upload) => [upload.filename, upload.contentType, upload.data])).toEqual([
      ["fr.pdf", "application/pdf", fr.data],
      ["en.pdf", "application/pdf", en.data],
    ])
  })

  it("writes the id the dataset answered, not the one it expected", async () => {
    const store = new MemoryStore()
    const fr = rulebookOf("fr")
    // the hash is the dataset's: another extension in the answer is what counts
    const upload = store.uploadFile.bind(store)
    store.uploadFile = async (file) => {
      await upload(file)
      return { _id: "file-answered-pdf" }
    }
    await place(store, [fr])
    expect(settingsDraft(store)?.rulesPdfFrFile).toEqual(fileRef("file-answered-pdf"))
  })

  it("only writes the settings document, as a draft, and never publishes", async () => {
    const store = new MemoryStore()
    await place(store, [rulebookOf("en")])
    expect(store.writes.flat().map((op) => (op.type === "createIfNotExists" ? op.doc._id : op.id))).toEqual(["drafts.settings"])
    expect(store.docs.has("settings")).toBe(false)
  })

  it("sends a file given for two languages once, and points both fields at it", async () => {
    const store = new MemoryStore()
    const same = pdf("same")
    const fr = { ...rulebookOf("fr", "same"), data: same, sha1: sha1Of(same) }
    const en = { ...rulebookOf("en", "same"), data: same, sha1: sha1Of(same) }
    const result = await place(store, [fr, en])
    expect(result.uploads).toBe(1)
    expect(store.fileUploads).toHaveLength(1)
    expect(settingsDraft(store)?.rulesPdfFrFile).toEqual(settingsDraft(store)?.rulesPdfEnFile)
  })

  it("reuses a file the dataset already holds, with no upload", async () => {
    const store = new MemoryStore()
    const fr = rulebookOf("fr")
    store.fileAssets.set(fr.sha1, "file-known-pdf")
    const result = await place(store, [fr])
    expect(result.uploads).toBe(0)
    expect(result.placements[0]).toMatchObject({ outcome: "placed", stored: true })
    expect(store.fileUploads).toEqual([])
    expect(settingsDraft(store)?.rulesPdfFrFile).toEqual(fileRef("file-known-pdf"))
  })

  it("does nothing the second time", async () => {
    const store = new MemoryStore()
    const rulebooks = [rulebookOf("fr"), rulebookOf("en")]
    await place(store, rulebooks)
    const again = await place(store, rulebooks)
    expect(again).toMatchObject({ action: "unchanged", uploads: 0, written: 0 })
    expect(again.placements.map(({ outcome, stored }) => [outcome, stored])).toEqual([
      ["already", true],
      ["already", true],
    ])
    expect(store.writes).toHaveLength(1)
    expect(store.fileUploads).toHaveLength(2)
  })

  it("adds a language to the draft without touching the ones already there", async () => {
    const store = new MemoryStore()
    await place(store, [rulebookOf("fr")])
    const before = settingsDraft(store)?.rulesPdfFrFile
    const result = await place(store, [rulebookOf("fr"), rulebookOf("de")])
    expect(result.action).toBe("update")
    expect(result.placements.map((placement) => placement.outcome)).toEqual(["already", "placed"])
    expect(settingsDraft(store)?.rulesPdfFrFile).toEqual(before)
    expect(settingsDraft(store)?.rulesPdfDeFile).toBeDefined()
    expect(store.fileUploads).toHaveLength(2)
  })

  it("keeps what the Studio editor set on the draft: other fields, and a rulebook that is already there", async () => {
    const store = new MemoryStore()
    store.put({ _id: "drafts.settings", _type: "settings", gameName: "Edited in the Studio", rulesPdfEnFile: fileRef("file-editor-pdf") })
    const result = await place(store, [rulebookOf("en"), rulebookOf("fr")])
    expect(result.placements.map((placement) => placement.outcome)).toEqual(["kept", "placed"])
    expect(result.uploads).toBe(1)
    expect(settingsDraft(store)).toMatchObject({ gameName: "Edited in the Studio", rulesPdfEnFile: fileRef("file-editor-pdf") })
    expect(settingsDraft(store)?.rulesPdfFrFile).toBeDefined()
  })

  it("keeps a different file and uploads nothing for it", async () => {
    const store = new MemoryStore()
    store.put({ _id: "drafts.settings", _type: "settings", rulesPdfEnFile: fileRef("file-editor-pdf") })
    const result = await place(store, [rulebookOf("en")])
    expect(result).toMatchObject({ action: "unchanged", uploads: 0, written: 0 })
    expect(result.placements[0]).toMatchObject({ outcome: "kept" })
    expect(store.fileUploads).toEqual([])
    expect(store.writes).toEqual([])
    expect(settingsDraft(store)?.rulesPdfEnFile).toEqual(fileRef("file-editor-pdf"))
  })

  it("fills a file field the editor emptied", async () => {
    const store = new MemoryStore()
    store.put({ _id: "drafts.settings", _type: "settings", rulesPdfEnFile: { _type: "file" } })
    const result = await place(store, [rulebookOf("en")])
    expect(result.placements[0]).toMatchObject({ outcome: "placed" })
    expect(settingsDraft(store)?.rulesPdfEnFile).toMatchObject({ _type: "file", asset: { _type: "reference" } })
  })

  it("makes a new draft from the published settings, which it leaves alone", async () => {
    const store = new MemoryStore()
    store.put({ _id: "settings", _type: "settings", gameName: "Published", rulesPdfEn: "https://example.com/rules.pdf" })
    const published = structuredClone(store.docs.get("settings"))
    const result = await place(store, [rulebookOf("fr")])
    expect(result.action).toBe("create-from-published")
    expect(store.docs.get("settings")).toEqual(published)
    expect(settingsDraft(store)).toMatchObject({ _id: "drafts.settings", gameName: "Published", rulesPdfEn: "https://example.com/rules.pdf" })
    expect(settingsDraft(store)?.rulesPdfFrFile).toBeDefined()
  })

  it("leaves other documents alone", async () => {
    const store = new MemoryStore()
    store.put({ _id: "drafts.interface", _type: "interface", logo: "x" })
    const before = structuredClone(store.docs.get("drafts.interface"))
    await place(store, [rulebookOf("en")])
    expect(store.docs.get("drafts.interface")).toEqual(before)
  })
})

describe("placeRulebooks · overwrite", () => {
  it("replaces the file a field holds, and says so", async () => {
    const store = new MemoryStore()
    store.put({ _id: "drafts.settings", _type: "settings", gameName: "Edited", rulesPdfEnFile: fileRef("file-editor-pdf") })
    const en = rulebookOf("en")
    const result = await place(store, [en], { overwrite: true })
    expect(result.placements[0]).toMatchObject({ outcome: "replaced" })
    expect(result.uploads).toBe(1)
    expect(settingsDraft(store)).toMatchObject({ gameName: "Edited", rulesPdfEnFile: fileRef(`file-${en.sha1}-pdf`) })
  })

  it("does not call a field that already holds the file replaced", async () => {
    const store = new MemoryStore()
    const en = rulebookOf("en")
    await place(store, [en])
    const result = await place(store, [en], { overwrite: true })
    expect(result.placements[0]).toMatchObject({ outcome: "already" })
    expect(result.written).toBe(0)
  })

  it("only touches the settings document, even if the dataset holds others of the same kind", async () => {
    const store = new MemoryStore()
    store.put({ _id: "drafts.settings", _type: "settings", rulesPdfEnFile: fileRef("file-editor-pdf") })
    store.put({ _id: "drafts.interface", _type: "interface", logo: "x" })
    await place(store, [rulebookOf("en")], { overwrite: true })
    expect(store.writes.flat().map((op) => (op.type === "createIfNotExists" ? op.doc._id : op.id))).toEqual(["drafts.settings"])
  })

  it("does not write over the published settings", async () => {
    const store = new MemoryStore()
    store.put({ _id: "settings", _type: "settings", rulesPdfEnFile: fileRef("file-published-pdf") })
    const result = await place(store, [rulebookOf("en")], { overwrite: true })
    expect(result.action).toBe("create-from-published")
    expect(store.docs.get("settings")).toMatchObject({ rulesPdfEnFile: fileRef("file-published-pdf") })
    expect(settingsDraft(store)?.rulesPdfEnFile).not.toEqual(fileRef("file-published-pdf"))
  })
})

describe("the reports", () => {
  const where = { projectId: "ho5ap9a6", dataset: "production" }

  it("lists the rulebooks that were read, and says nothing is sent", () => {
    const text = formatRulebookList([rulebookOf("fr", "regles"), rulebookOf("en", "rules")])
    expect(text).toContain("Rulebooks read (nothing is sent anywhere):")
    expect(text).toMatch(/fr {2}regles\.pdf\s+\d+ KB {2}PDF, goes in "Rules PDF \(FR\)"/)
    expect(text).toMatch(/en {2}rules\.pdf\s+\d+ KB {2}PDF, goes in "Rules PDF \(EN\)"/)
  })

  it("tells a dry run from a write, and what to do next", async () => {
    const store = new MemoryStore()
    const rulebooks = [rulebookOf("fr"), rulebookOf("en")]
    const dry = formatRulebookReport(await place(store, rulebooks, { apply: false }), where)
    expect(dry).toContain("Rulebooks · project ho5ap9a6 · dataset production")
    expect(dry).toContain("DRY RUN: nothing was written or uploaded. Run again with --apply to place the rulebooks.")
    expect(dry).toContain('to place in "Rules PDF (FR)"')
    expect(dry).toContain("Settings: new draft")
    expect(dry).toContain("Files: 2 to upload, 0 already in the dataset")
    expect(dry).toContain("Next: run with --apply. Only a draft of Settings is written; publishing stays a Studio action.")

    const applied = formatRulebookReport(await place(store, rulebooks), where)
    expect(applied).toContain("APPLIED: 2 rulebook(s) placed in the draft of Settings (Mechanics tab). Nothing is published.")
    expect(applied).toContain('placed in "Rules PDF (EN)"')
    expect(applied).toContain("Files: 2 uploaded, 0 already in the dataset")
    expect(applied).toContain("Verified: planning again after the write finds nothing to do")
    expect(applied).toContain("Open the Studio (Settings › Mechanics), check the draft and publish it.")
  })

  it("says nothing is left to place when the dataset has it all", async () => {
    const store = new MemoryStore()
    const rulebooks = [rulebookOf("en")]
    await place(store, rulebooks)
    const text = formatRulebookReport(await place(store, rulebooks, { apply: false }), where)
    expect(text).toContain('"Rules PDF (EN)" holds this file already')
    expect(text).toContain("Settings: draft untouched")
    expect(text).toContain("Next: nothing to place, the dataset already has what was asked.")
    expect(text).not.toContain("Run again with --apply")
  })

  it("says what a kept and a replaced field are, and how to replace one", async () => {
    const store = new MemoryStore()
    store.put({ _id: "drafts.settings", _type: "settings", rulesPdfEnFile: fileRef("file-editor-pdf") })
    const kept = formatRulebookReport(await place(store, [rulebookOf("en")], { apply: false }), where)
    expect(kept).toContain('"Rules PDF (EN)" holds another file, kept (--overwrite replaces it)')
    const replaced = formatRulebookReport(await place(store, [rulebookOf("en")], { apply: false, overwrite: true }), where)
    expect(replaced).toContain('to replace what "Rules PDF (EN)" holds (--overwrite)')
    const done = formatRulebookReport(await place(store, [rulebookOf("en")], { overwrite: true }), where)
    expect(done).toContain('replaced what "Rules PDF (EN)" held (--overwrite)')
  })

  it("counts the files the dataset already held", async () => {
    const store = new MemoryStore()
    const fr = rulebookOf("fr")
    store.fileAssets.set(fr.sha1, "file-known-pdf")
    const text = formatRulebookReport(await place(store, [fr, rulebookOf("en")]), where)
    expect(text).toContain("Files: 1 uploaded, 1 already in the dataset")
  })

  it("carries nothing but what the result holds: no file content, no token", async () => {
    const store = new MemoryStore()
    const result: RulebookResult = await place(store, [rulebookOf("en")])
    const text = formatRulebookReport(result, where)
    expect(text).not.toContain("%PDF")
    expect(text).not.toMatch(/sk[A-Za-z0-9]{20,}/)
  })
})
