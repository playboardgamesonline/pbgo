import { createHash } from "node:crypto"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import sharp from "sharp"
import { afterEach, describe, expect, it } from "vitest"
import { assetIdOf, imageRef, loadArt, normalizeImage, placeArt, scanArtDir, uploadArt } from "./art.ts"
import type { ArtSlot, LoadedArt } from "./art.ts"
import { MemoryStore } from "./memory-store.ts"
import { TempFolders, imageOf } from "./test-fixtures.ts"
import type { SeedDoc } from "./types.ts"

const slot = (name: string, extra: Partial<ArtSlot> = {}): ArtSlot => ({ name, label: `Picture ${name}`, maxSize: 100, docId: "doc", place: () => {}, ...extra })

const sha1 = (data: Buffer) => createHash("sha1").update(data).digest("hex")
const metaOf = (data: Buffer) => sharp(data).metadata()
const svg = (inner = "") => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${inner}<rect width="10" height="10"/></svg>`)
const blank = (width: number, height: number, channels: 3 | 4 = 3) => sharp({ create: { width, height, channels, background: { r: 200, g: 30, b: 0, alpha: channels === 4 ? 0.5 : 1 } } })
const imageFor = (art: LoadedArt, name: string) => art.images.find((entry) => entry.slot.name === name)

const temp = new TempFolders()
afterEach(() => temp.cleanUp())

describe("scanArtDir", () => {
  it("matches the files to the slots by name, whatever the case, the spaces and the underscores", async () => {
    const dir = await temp.create({ "Card_Red 3.PNG": "x", "suit-blue.jpg": "x", "VALUE_4.webp": "x" })
    const scan = await scanArtDir(dir, [slot("card-red-3"), slot("suit-blue"), slot("value-4"), slot("clue-token")])
    expect(scan.found.map((entry) => [entry.slot.name, entry.file])).toEqual([
      ["card-red-3", "Card_Red 3.PNG"],
      ["suit-blue", "suit-blue.jpg"],
      ["value-4", "VALUE_4.webp"],
    ])
    expect(scan.missing.map((entry) => entry.name)).toEqual(["clue-token"])
    expect(scan.unmatched).toEqual([])
    expect(scan.duplicates).toEqual([])
  })

  it("accepts the other names of a slot", async () => {
    const dir = await temp.create({ "suit-rainbow.png": "x" })
    const scan = await scanArtDir(dir, [slot("suit-multi", { aliases: ["suit-rainbow"] })])
    expect(scan.found.map((entry) => entry.file)).toEqual(["suit-rainbow.png"])
    expect(scan.missing).toEqual([])
  })

  it("lists what it found in the order of the slots, not of the files", async () => {
    const dir = await temp.create({ "a.png": "x", "b.png": "x", "c.png": "x" })
    const scan = await scanArtDir(dir, [slot("c"), slot("a"), slot("b")])
    expect(scan.found.map((entry) => entry.slot.name)).toEqual(["c", "a", "b"])
  })

  it("reports the image files that match no slot", async () => {
    const dir = await temp.create({ "typo.png": "x", "card-red-3.png.png": "x", "a.png": "x" })
    const scan = await scanArtDir(dir, [slot("a")])
    expect(scan.unmatched).toEqual(["card-red-3.png.png", "typo.png"])
    expect(scan.found.map((entry) => entry.file)).toEqual(["a.png"])
  })

  it("reads SVG, PNG, JPEG and WebP, in any case", async () => {
    const dir = await temp.create({ "a.svg": "x", "b.PNG": "x", "c.jpg": "x", "d.JPEG": "x", "e.webP": "x" })
    const scan = await scanArtDir(dir, ["a", "b", "c", "d", "e"].map((name) => slot(name)))
    expect(scan.found).toHaveLength(5)
  })

  it("ignores what is not an image", async () => {
    const dir = await temp.create({ "notes.txt": "x", "rules.pdf": "x", "photo.gif": "x", "scan.tiff": "x", "design.psd": "x" })
    const scan = await scanArtDir(dir, [slot("notes")])
    expect(scan.unmatched).toEqual([])
    expect(scan.found).toEqual([])
    expect(scan.missing).toHaveLength(1)
  })

  it("ignores hidden files and sub-folders", async () => {
    const dir = await temp.create({ ".DS_Store": "x", ".card-red-3.png": "x" })
    await mkdir(join(dir, "old"))
    await writeFile(join(dir, "old", "card-red-3.png"), "x")
    await mkdir(join(dir, "card-blue-1.png"))
    const scan = await scanArtDir(dir, [slot("card-red-3"), slot("card-blue-1")])
    expect(scan.found).toEqual([])
    expect(scan.unmatched).toEqual([])
    expect(scan.missing).toHaveLength(2)
  })

  it("does not choose between several files for one slot", async () => {
    const dir = await temp.create({ "card-red-3.png": "x", "card-red-3.jpg": "x", "ok.png": "x" })
    const target = slot("card-red-3")
    const scan = await scanArtDir(dir, [target, slot("ok")])
    expect(scan.duplicates).toEqual([{ slot: target, files: ["card-red-3.jpg", "card-red-3.png"] }])
    expect(scan.found.map((entry) => entry.slot.name)).toEqual(["ok"])
    expect(scan.missing).toEqual([])
  })

  it("sees two spellings of one name, and a name next to its alias, as several files", async () => {
    const spelled = await temp.create({ "Card_Red_3.png": "x", "card-red-3.png": "x" })
    expect((await scanArtDir(spelled, [slot("card-red-3")])).duplicates).toHaveLength(1)
    const aliased = await temp.create({ "suit-multi.png": "x", "suit-rainbow.png": "x" })
    expect((await scanArtDir(aliased, [slot("suit-multi", { aliases: ["suit-rainbow"] })])).duplicates).toHaveLength(1)
  })

  it("calls every slot missing in an empty folder", async () => {
    const dir = await temp.create()
    const scan = await scanArtDir(dir, [slot("a"), slot("b")])
    expect(scan).toEqual({ found: [], missing: [expect.objectContaining({ name: "a" }), expect.objectContaining({ name: "b" })], unmatched: [], duplicates: [] })
  })

  it("says so when the folder does not exist", async () => {
    const dir = join(await temp.create(), "nope")
    await expect(scanArtDir(dir, [slot("a")])).rejects.toThrow(`Art folder not found: ${dir}`)
  })

  it("does not hide any other reason why the folder cannot be read", async () => {
    const dir = await temp.create({ "file.txt": "x" })
    const error = await scanArtDir(join(dir, "file.txt"), [slot("a")]).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(Error)
    expect((error as NodeJS.ErrnoException).code).toBe("ENOTDIR")
    expect((error as Error).message).not.toContain("Art folder not found")
  })

  it("refuses two slots that answer to the same name, before it reads anything", async () => {
    const dir = join(await temp.create(), "never-read")
    await expect(scanArtDir(dir, [slot("a"), slot("a")])).rejects.toThrow('Art slot name "a" is used twice')
    await expect(scanArtDir(dir, [slot("a", { aliases: ["b"] }), slot("b")])).rejects.toThrow('Art slot name "b" is used twice')
    await expect(scanArtDir(dir, [slot("card-a"), slot("Card_A")])).rejects.toThrow('Art slot name "Card_A" is used twice')
  })
})

describe("normalizeImage", () => {
  it("turns a raster into WebP and describes it", async () => {
    const input = await imageOf("#cc2200", { width: 40, height: 56 })
    const out = await normalizeImage(input, ".png", { maxSize: 100 })
    expect(out).toMatchObject({ contentType: "image/webp", ext: "webp", width: 40, height: 56 })
    expect(await metaOf(out.data)).toMatchObject({ format: "webp", width: 40, height: 56 })
    expect(out.sha1).toBe(sha1(out.data))
  })

  it("shrinks to the longest side and keeps the proportions", async () => {
    const portrait = await normalizeImage(await imageOf("#cc2200", { width: 400, height: 560 }), ".png", { maxSize: 100 })
    expect([portrait.width, portrait.height]).toEqual([71, 100])
    const landscape = await normalizeImage(await imageOf("#cc2200", { width: 560, height: 400 }), ".png", { maxSize: 100 })
    expect([landscape.width, landscape.height]).toEqual([100, 71])
    expect(await metaOf(portrait.data)).toMatchObject({ width: 71, height: 100 })
  })

  it("never enlarges", async () => {
    const out = await normalizeImage(await imageOf("#cc2200", { width: 40, height: 56 }), ".png", { maxSize: 1000 })
    expect([out.width, out.height]).toEqual([40, 56])
  })

  it("applies the orientation of the photo, so that the file shows as the editor saw it", async () => {
    const input = await blank(40, 20).jpeg().withMetadata({ orientation: 6 }).toBuffer()
    expect(await metaOf(input)).toMatchObject({ width: 40, height: 20, orientation: 6 })
    const out = await normalizeImage(input, ".jpg", { maxSize: 100 })
    expect([out.width, out.height]).toEqual([20, 40])
    expect((await metaOf(out.data)).orientation).toBeUndefined()
  })

  it("drops the metadata of the file", async () => {
    const input = await blank(40, 56).jpeg().withExif({ IFD0: { Copyright: "not for the web" } }).toBuffer()
    expect((await metaOf(input)).exif).toBeDefined()
    const out = await normalizeImage(input, ".jpg", { maxSize: 100 })
    expect((await metaOf(out.data)).exif).toBeUndefined()
  })

  it("keeps the transparency", async () => {
    const out = await normalizeImage(await blank(40, 56, 4).png().toBuffer(), ".png", { maxSize: 100 })
    expect((await metaOf(out.data)).hasAlpha).toBe(true)
    const { data } = await sharp(out.data).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    expect(data[3]).toBeGreaterThanOrEqual(120)
    expect(data[3]).toBeLessThanOrEqual(135)
  })

  it("gives the same bytes for the same picture, and other bytes for another", async () => {
    const red = await imageOf("#cc2200")
    const first = await normalizeImage(red, ".png", { maxSize: 100 })
    const second = await normalizeImage(red, ".png", { maxSize: 100 })
    const blue = await normalizeImage(await imageOf("#0022cc"), ".png", { maxSize: 100 })
    expect(first.data.equals(second.data)).toBe(true)
    expect(first.sha1).toBe(second.sha1)
    expect(blue.sha1).not.toBe(first.sha1)
  })

  it("reads the content, not the extension", async () => {
    const out = await normalizeImage(await imageOf("#cc2200"), ".jpg", { maxSize: 100 })
    expect([out.width, out.height]).toEqual([40, 56])
  })

  it("does not read what is not an image", async () => {
    await expect(normalizeImage(Buffer.from("this is not an image"), ".png", { maxSize: 100 })).rejects.toThrow()
  })

  describe("SVG", () => {
    it("is kept exactly as it is", async () => {
      const input = svg()
      const out = await normalizeImage(input, ".svg", { maxSize: 100 })
      expect(out).toMatchObject({ contentType: "image/svg+xml", ext: "svg", width: 0, height: 0, sha1: sha1(input) })
      expect(out.data.equals(input)).toBe(true)
    })

    it("accepts text and styles", async () => {
      const input = svg("<style>.a { fill: red }</style><text>on top, once</text>")
      await expect(normalizeImage(input, ".svg", { maxSize: 100 })).resolves.toMatchObject({ ext: "svg" })
      await expect(normalizeImage(Buffer.from(svg().toString().toUpperCase()), ".svg", { maxSize: 100 })).resolves.toMatchObject({ ext: "svg" })
    })

    it.each(["", "plain text", "<html><body>hi</body></html>", "<svgfoo></svgfoo>"])("refuses %j: not an SVG", async (text) => {
      await expect(normalizeImage(Buffer.from(text), ".svg", { maxSize: 100 })).rejects.toThrow("not an SVG document")
    })

    it.each([
      ["a script", svg("<script>alert(1)</script>")],
      ["a script in capitals", svg("<SCRIPT>alert(1)</SCRIPT>")],
      ["an onload handler", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>')],
      ["a handler with spaces around the sign", svg('<rect onclick = "alert(1)"/>')],
      ["a handler on its own line", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"\nonmouseover="alert(1)"></svg>')],
      ["a javascript: link", svg('<a href="javascript:alert(1)"><rect/></a>')],
    ])("refuses an SVG with %s", async (_name, input) => {
      await expect(normalizeImage(input, ".svg", { maxSize: 100 })).rejects.toThrow("the SVG contains a script or an event handler")
    })
  })
})

describe("asset ids", () => {
  it("names a raster the way Sanity does, so that a dry run can point at it", () => {
    expect(assetIdOf({ sha1: "abc", ext: "webp", width: 71, height: 100 })).toBe("image-abc-71x100-webp")
  })

  it("names an SVG without a size", () => {
    expect(assetIdOf({ sha1: "abc", ext: "svg", width: 0, height: 0 })).toBe("image-abc-svg")
  })

  it("builds the reference of an image field", () => {
    expect(imageRef("image-abc-1x1-webp")).toEqual({ _type: "image", asset: { _type: "reference", _ref: "image-abc-1x1-webp" } })
  })
})

describe("loadArt", () => {
  it("reads, normalizes and names every matched file, in the order of the slots", async () => {
    const dir = await temp.create({ "card.png": await imageOf("#cc2200", { width: 400, height: 560 }), "icon.png": await imageOf("#0022cc", { width: 30, height: 30 }) })
    const art = await loadArt({ dir, slots: [slot("icon"), slot("card", { ratio: [5, 7] })], store: new MemoryStore() })
    expect(art.images.map((entry) => [entry.slot.name, entry.file])).toEqual([
      ["icon", "icon.png"],
      ["card", "card.png"],
    ])
    const card = imageFor(art, "card")
    expect(card).toMatchObject({ exists: false, warnings: [] })
    expect([card?.image.width, card?.image.height]).toEqual([71, 100])
    expect(card?.assetId).toBe(card && assetIdOf(card.image))
  })

  it("recognizes a picture the dataset already holds, and takes its real id", async () => {
    const dir = await temp.create({ "a.png": await imageOf("#cc2200") })
    const store = new MemoryStore()
    const first = await loadArt({ dir, slots: [slot("a")], store })
    const hash = first.images[0]?.image.sha1 ?? ""
    store.assets.set(hash, "image-from-the-dataset-40x56-webp")
    const second = await loadArt({ dir, slots: [slot("a")], store })
    expect(second.images[0]).toMatchObject({ exists: true, assetId: "image-from-the-dataset-40x56-webp" })
  })

  it("asks the dataset once, about each picture once", async () => {
    class SpyStore extends MemoryStore {
      lookups: string[][] = []
      override async findImageAssets(sha1s: string[]) {
        this.lookups.push(sha1s)
        return super.findImageAssets(sha1s)
      }
    }
    const same = await imageOf("#cc2200")
    const dir = await temp.create({ "a.png": same, "b.png": same, "c.png": await imageOf("#0022cc") })
    const store = new SpyStore()
    const art = await loadArt({ dir, slots: [slot("a"), slot("b"), slot("c")], store })
    expect(store.lookups).toHaveLength(1)
    expect(store.lookups[0]).toHaveLength(2)
    expect(new Set(store.lookups[0])).toEqual(new Set(art.images.map((entry) => entry.image.sha1)))
  })

  it("loads nothing from an empty folder, and says what is missing", async () => {
    const art = await loadArt({ dir: await temp.create(), slots: [slot("a"), slot("b")], store: new MemoryStore() })
    expect(art.images).toEqual([])
    expect(art.scan.missing.map((entry) => entry.name)).toEqual(["a", "b"])
  })

  describe("proportions", () => {
    const card = slot("card", { ratio: [5, 7], maxSize: 1400 })
    const warningsFor = async (size: { width: number; height: number }, target: ArtSlot = card) => {
      const dir = await temp.create({ [`${target.name}.png`]: await imageOf("#cc2200", size) })
      const art = await loadArt({ dir, slots: [target], store: new MemoryStore() })
      return art.images[0]?.warnings
    }

    it("accepts the right proportions and a few percent of difference", async () => {
      expect(await warningsFor({ width: 50, height: 70 })).toEqual([])
      expect(await warningsFor({ width: 51, height: 70 })).toEqual([])
    })

    it("warns about other proportions, and still loads the file", async () => {
      expect(await warningsFor({ width: 100, height: 100 })).toEqual(["card.png is 100×100, expected 5:7"])
      expect(await warningsFor({ width: 50, height: 66 })).toEqual(["card.png is 50×66, expected 5:7"])
    })

    it("checks only the slots that have proportions", async () => {
      expect(await warningsFor({ width: 100, height: 100 }, slot("card"))).toEqual([])
    })

    it("does not check an SVG, which has no pixel size", async () => {
      const dir = await temp.create({ "card.svg": svg() })
      const art = await loadArt({ dir, slots: [card], store: new MemoryStore() })
      expect(art.images[0]?.warnings).toEqual([])
    })
  })

  describe("what must stop the run", () => {
    it("several files for one slot", async () => {
      const dir = await temp.create({ "a.png": await imageOf("#cc2200"), "a.jpg": await imageOf("#cc2200", undefined, "jpeg"), "b.png": await imageOf("#cc2200") })
      await expect(loadArt({ dir, slots: [slot("a"), slot("b")], store: new MemoryStore() })).rejects.toThrow("Several files for one art slot, keep one of each:\n  a: a.jpg, a.png")
    })

    it("a file that cannot be read, named in the message", async () => {
      const dir = await temp.create({ "a.png": "this is not an image" })
      await expect(loadArt({ dir, slots: [slot("a")], store: new MemoryStore() })).rejects.toThrow(/^a\.png: /)
    })

    it("an SVG that is not safe, named in the message", async () => {
      const dir = await temp.create({ "a.svg": svg("<script>alert(1)</script>") })
      await expect(loadArt({ dir, slots: [slot("a")], store: new MemoryStore() })).rejects.toThrow("a.svg: the SVG contains a script or an event handler")
    })

    it("a folder that does not exist", async () => {
      const dir = join(await temp.create(), "nope")
      await expect(loadArt({ dir, slots: [slot("a")], store: new MemoryStore() })).rejects.toThrow(`Art folder not found: ${dir}`)
    })
  })

  describe("limited to some documents", () => {
    const slots = [slot("a-pic", { docId: "a" }), slot("b-pic", { docId: "b" })]

    it("leaves the other documents' files aside", async () => {
      const dir = await temp.create({ "a-pic.png": await imageOf("#cc2200"), "b-pic.png": await imageOf("#0022cc"), "stray.png": await imageOf("#00cc22") })
      const art = await loadArt({ dir, slots, store: new MemoryStore(), docIds: new Set(["a"]) })
      expect(art.images.map((entry) => entry.slot.name)).toEqual(["a-pic"])
      expect(art.scan.found.map((entry) => entry.slot.name)).toEqual(["a-pic"])
      expect(art.scan.missing).toEqual([])
      expect(art.scan.unmatched).toEqual(["stray.png"])
    })

    it("only reports as missing what belongs to those documents", async () => {
      const art = await loadArt({ dir: await temp.create(), slots, store: new MemoryStore(), docIds: new Set(["b"]) })
      expect(art.scan.missing.map((entry) => entry.name)).toEqual(["b-pic"])
    })

    it("does not stop for a duplicate in a document that is left out", async () => {
      const dir = await temp.create({ "a-pic.png": await imageOf("#cc2200"), "b-pic.png": await imageOf("#0022cc"), "b-pic.jpg": await imageOf("#0022cc", undefined, "jpeg") })
      const art = await loadArt({ dir, slots, store: new MemoryStore(), docIds: new Set(["a"]) })
      expect(art.images).toHaveLength(1)
    })
  })

  it("never touches the files it reads", async () => {
    const dir = await temp.create({ "a.png": await imageOf("#cc2200", { width: 400, height: 560 }), "b.svg": svg() })
    const snapshot = async () => Promise.all((await readdir(dir)).sort().map(async (name) => [name, sha1(await readFile(join(dir, name)))]))
    const before = await snapshot()
    const store = new MemoryStore()
    const art = await loadArt({ dir, slots: [slot("a"), slot("b")], store })
    await uploadArt(art, store)
    expect(await snapshot()).toEqual(before)
  })
})

describe("uploadArt", () => {
  it("uploads each new picture, named after its slot, and remembers the id", async () => {
    const dir = await temp.create({ "a.png": await imageOf("#cc2200"), "b.svg": svg() })
    const store = new MemoryStore()
    const art = await loadArt({ dir, slots: [slot("a"), slot("b")], store })
    expect(await uploadArt(art, store)).toBe(2)
    expect(store.uploads.map((file) => [file.filename, file.contentType])).toEqual([
      ["a.webp", "image/webp"],
      ["b.svg", "image/svg+xml"],
    ])
    expect(art.images.every((entry) => entry.exists)).toBe(true)
    expect(art.images.map((entry) => entry.assetId)).toEqual([...store.assets.values()])
  })

  it("uploads what the dataset does not hold, and nothing else", async () => {
    const dir = await temp.create({ "a.png": await imageOf("#cc2200"), "b.png": await imageOf("#0022cc") })
    const store = new MemoryStore()
    await uploadArt(await loadArt({ dir, slots: [slot("a")], store }), store)
    expect(store.uploads).toHaveLength(1)
    const art = await loadArt({ dir, slots: [slot("a"), slot("b")], store })
    expect(await uploadArt(art, store)).toBe(1)
    expect(store.uploads.map((file) => file.filename)).toEqual(["a.webp", "b.webp"])
  })

  it("uploads nothing the second time", async () => {
    const dir = await temp.create({ "a.png": await imageOf("#cc2200") })
    const store = new MemoryStore()
    await uploadArt(await loadArt({ dir, slots: [slot("a")], store }), store)
    expect(await uploadArt(await loadArt({ dir, slots: [slot("a")], store }), store)).toBe(0)
    expect(store.uploads).toHaveLength(1)
  })

  it("uploads a picture used by two slots once, under the first slot's name", async () => {
    const same = await imageOf("#cc2200")
    const dir = await temp.create({ "a.png": same, "b.png": same })
    const store = new MemoryStore()
    const art = await loadArt({ dir, slots: [slot("a"), slot("b")], store })
    expect(await uploadArt(art, store)).toBe(1)
    expect(store.uploads.map((file) => file.filename)).toEqual(["a.webp"])
    expect(art.images[0]?.assetId).toBe(art.images[1]?.assetId)
  })

  it("lets the failure of the dataset through", async () => {
    class RefusingStore extends MemoryStore {
      override async uploadImage(): Promise<{ _id: string }> {
        throw new Error("upload refused")
      }
    }
    const dir = await temp.create({ "a.png": await imageOf("#cc2200") })
    const store = new RefusingStore()
    await expect(uploadArt(await loadArt({ dir, slots: [slot("a")], store }), store)).rejects.toThrow("upload refused")
  })
})

describe("placeArt", () => {
  const placing = (name: string, docId: string, field: string) =>
    slot(name, {
      docId,
      place: (doc, image) => {
        doc[field] = image
      },
    })
  const docs = (): SeedDoc[] => [
    { _id: "a", _type: "thing" },
    { _id: "b", _type: "thing" },
  ]

  it("puts every image where its slot says, in the document of the slot", async () => {
    const dir = await temp.create({ "a-pic.png": await imageOf("#cc2200"), "a-back.png": await imageOf("#0022cc"), "b-pic.png": await imageOf("#00cc22") })
    const art = await loadArt({ dir, slots: [placing("a-pic", "a", "picture"), placing("a-back", "a", "back"), placing("b-pic", "b", "picture")], store: new MemoryStore() })
    const target = docs()
    placeArt(art, target)
    expect(target[0]?.picture).toEqual(imageRef(imageFor(art, "a-pic")?.assetId ?? ""))
    expect(target[0]?.back).toEqual(imageRef(imageFor(art, "a-back")?.assetId ?? ""))
    expect(target[1]?.picture).toEqual(imageRef(imageFor(art, "b-pic")?.assetId ?? ""))
    expect(target[1]?.back).toBeUndefined()
  })

  it("leaves the documents alone when there is no image", async () => {
    const art = await loadArt({ dir: await temp.create(), slots: [placing("a-pic", "a", "picture")], store: new MemoryStore() })
    const target = docs()
    placeArt(art, target)
    expect(target).toEqual(docs())
  })

  it("stops when the document of a slot is not in the seed", async () => {
    const dir = await temp.create({ "lost.png": await imageOf("#cc2200") })
    const art = await loadArt({ dir, slots: [placing("lost", "missing", "picture")], store: new MemoryStore() })
    expect(() => placeArt(art, docs())).toThrow('Art slot "lost" points at "missing", which is not in the seed')
  })
})
