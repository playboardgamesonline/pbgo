import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { extname, join } from "node:path"
import sharp from "sharp"
import type { ImageValue, SeedDoc, SeedStore } from "./types.ts"

/** One image the content needs, and where it goes. */
export type ArtSlot = {
  /** File name, without extension, that fills the slot: `card-front-3` */
  name: string
  /** Other file names accepted for the slot */
  aliases?: string[]
  label: string
  /** width : height; a file that is off by more than 3 % is accepted with a warning */
  ratio?: [number, number]
  /** Longest side kept, in pixels; smaller images are never enlarged */
  maxSize: number
  /** Published id of the document that holds the image */
  docId: string
  /** Puts the image where it belongs in that document */
  place: (doc: SeedDoc, image: ImageValue) => void
}

const RASTER_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"])
const IMAGE_EXTENSIONS = new Set([...RASTER_EXTENSIONS, ".svg"])
const RATIO_TOLERANCE = 0.03

/** `Card_Front 3.PNG` and `card-front-3.png` are the same name. */
const stemOf = (file: string) => file.slice(0, file.length - extname(file).length).toLowerCase().replace(/[\s_]+/g, "-")

export type ArtScan = {
  found: { slot: ArtSlot; file: string }[]
  /** Slots that have no file yet */
  missing: ArtSlot[]
  /** Image files that match no slot: a typo in the name? */
  unmatched: string[]
  /** Slots with several files, such as `card-front-3.png` next to `card-front-3.jpg` */
  duplicates: { slot: ArtSlot; files: string[] }[]
}

/** Reads one folder (not its sub-folders) and matches the image files to the slots by name. */
export async function scanArtDir(dir: string, slots: ArtSlot[]): Promise<ArtScan> {
  const bySlotName = new Map<string, ArtSlot>()
  for (const slot of slots) {
    for (const name of [slot.name, ...(slot.aliases ?? [])]) {
      const key = stemOf(`${name}.x`)
      if (bySlotName.has(key)) throw new Error(`Art slot name "${name}" is used twice`)
      bySlotName.set(key, slot)
    }
  }

  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error(`Art folder not found: ${dir}`)
    throw error
  }

  const files = entries
    .filter((entry) => entry.isFile() && !entry.name.startsWith(".") && IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort()

  const filesBySlot = new Map<ArtSlot, string[]>()
  const unmatched: string[] = []
  for (const file of files) {
    const slot = bySlotName.get(stemOf(file))
    if (!slot) unmatched.push(file)
    else filesBySlot.set(slot, [...(filesBySlot.get(slot) ?? []), file])
  }

  const found: ArtScan["found"] = []
  const duplicates: ArtScan["duplicates"] = []
  for (const slot of slots) {
    const matches = filesBySlot.get(slot)
    if (!matches) continue
    const [file] = matches
    if (matches.length > 1) duplicates.push({ slot, files: matches })
    else if (file) found.push({ slot, file })
  }
  return { found, missing: slots.filter((slot) => !filesBySlot.has(slot)), unmatched, duplicates }
}

export type NormalizedImage = { data: Buffer; contentType: string; ext: "webp" | "svg"; width: number; height: number; sha1: string }

const sha1Of = (data: Buffer) => createHash("sha1").update(data).digest("hex")

/**
 * What goes to Sanity: rasters become WebP (orientation applied, metadata dropped, never enlarged, alpha kept), SVG is kept as it is.
 * The original file is never touched: this works on a copy in memory.
 */
export async function normalizeImage(input: Buffer, extension: string, slot: Pick<ArtSlot, "maxSize">): Promise<NormalizedImage> {
  if (extension === ".svg") {
    const text = input.toString("utf8")
    if (!/<svg[\s>]/i.test(text)) throw new Error("not an SVG document")
    if (/<script|javascript:|\son[a-z]+\s*=/i.test(text)) throw new Error("the SVG contains a script or an event handler")
    return { data: input, contentType: "image/svg+xml", ext: "svg", width: 0, height: 0, sha1: sha1Of(input) }
  }
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: slot.maxSize, height: slot.maxSize, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 86, alphaQuality: 100, effort: 5 })
    .toBuffer({ resolveWithObject: true })
  return { data, contentType: "image/webp", ext: "webp", width: info.width, height: info.height, sha1: sha1Of(data) }
}

/** The id Sanity gives an image asset, so that a dry run can name it before the upload. The real id wins once it is known. */
export const assetIdOf = (image: Pick<NormalizedImage, "sha1" | "ext" | "width" | "height">) =>
  image.ext === "svg" ? `image-${image.sha1}-svg` : `image-${image.sha1}-${image.width}x${image.height}-${image.ext}`

export const imageRef = (assetId: string): ImageValue => ({ _type: "image", asset: { _type: "reference", _ref: assetId } })

export type LoadedImage = {
  slot: ArtSlot
  file: string
  image: NormalizedImage
  assetId: string
  /** The dataset already holds this exact image */
  exists: boolean
  warnings: string[]
}

export type LoadedArt = { scan: ArtScan; images: LoadedImage[] }

/**
 * Scans, normalizes and looks the images up in the dataset. Uploads nothing.
 * `docIds` limits the work to the slots of these documents (a run with `--only`); a file for another slot is simply left aside.
 */
export async function loadArt({ dir, slots, store, docIds }: { dir: string; slots: ArtSlot[]; store: SeedStore; docIds?: ReadonlySet<string> }): Promise<LoadedArt> {
  const all = await scanArtDir(dir, slots)
  const wanted = (slot: ArtSlot) => !docIds || docIds.has(slot.docId)
  const scan: ArtScan = {
    found: all.found.filter(({ slot }) => wanted(slot)),
    missing: all.missing.filter(wanted),
    unmatched: all.unmatched,
    duplicates: all.duplicates.filter(({ slot }) => wanted(slot)),
  }
  if (scan.duplicates.length) {
    const lines = scan.duplicates.map(({ slot, files }) => `${slot.name}: ${files.join(", ")}`)
    throw new Error(`Several files for one art slot, keep one of each:\n  ${lines.join("\n  ")}`)
  }

  const images: LoadedImage[] = []
  for (const { slot, file } of scan.found) {
    let image: NormalizedImage
    try {
      image = await normalizeImage(await readFile(join(dir, file)), extname(file).toLowerCase(), slot)
    } catch (error) {
      throw new Error(`${file}: ${error instanceof Error ? error.message : "cannot be read as an image"}`)
    }
    const warnings: string[] = []
    if (slot.ratio && image.width && image.height) {
      const [w, h] = slot.ratio
      if (Math.abs(image.width / image.height - w / h) / (w / h) > RATIO_TOLERANCE) warnings.push(`${file} is ${image.width}×${image.height}, expected ${w}:${h}`)
    }
    images.push({ slot, file, image, assetId: assetIdOf(image), exists: false, warnings })
  }

  const known = await store.findImageAssets([...new Set(images.map(({ image }) => image.sha1))])
  for (const loaded of images) {
    const id = known.get(loaded.image.sha1)
    if (id) {
      loaded.assetId = id
      loaded.exists = true
    }
  }
  return { scan, images }
}

/** Uploads the images the dataset does not hold yet (assets have no draft state: they are visible at once, but nothing uses them until a document points at them). Returns how many were uploaded. */
export async function uploadArt(art: LoadedArt, store: SeedStore): Promise<number> {
  const uploaded = new Map<string, string>()
  for (const loaded of art.images) {
    if (loaded.exists) continue
    let id = uploaded.get(loaded.image.sha1)
    if (!id) {
      const asset = await store.uploadImage({ data: loaded.image.data, filename: `${loaded.slot.name}.${loaded.image.ext}`, contentType: loaded.image.contentType })
      id = asset._id
      uploaded.set(loaded.image.sha1, id)
    }
    loaded.assetId = id
    loaded.exists = true
  }
  return uploaded.size
}

/** Puts every image where its slot says, in the seed documents. */
export function placeArt(art: LoadedArt, docs: SeedDoc[]): void {
  for (const { slot, assetId } of art.images) {
    const doc = docs.find((candidate) => candidate._id === slot.docId)
    if (!doc) throw new Error(`Art slot "${slot.name}" points at "${slot.docId}", which is not in the seed`)
    slot.place(doc, imageRef(assetId))
  }
}
