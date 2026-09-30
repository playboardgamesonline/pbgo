import "server-only"
import sharp from "sharp"
import { ApiError } from "./api"

export type Converted = { buffer: Buffer; filename: string; contentType: string }

const base = (name: string) => name.replace(/\.[^.]+$/, "") || "file"
const isSvg = (file: File) => file.type === "image/svg+xml" || /\.svg$/i.test(file.name)

/** Images de l'habillage : SVG gardé tel quel, le reste converti en WebP (transparence et animation conservées). */
export async function imageToWebp(file: File): Promise<Converted> {
  const input = Buffer.from(await file.arrayBuffer())
  if (isSvg(file)) return { buffer: input, filename: file.name, contentType: "image/svg+xml" }
  try {
    const buffer = await sharp(input, { animated: true }).rotate().webp({ quality: 90, effort: 4 }).toBuffer()
    return { buffer, filename: `${base(file.name)}.webp`, contentType: "image/webp" }
  } catch {
    throw new ApiError("INVALID_FILE")
  }
}

/** Favicon : SVG gardé, sinon PNG carré 512 px (fond transparent) — les navigateurs et iOS n'acceptent pas le WebP ici. */
export async function imageToIcon(file: File): Promise<Converted> {
  const input = Buffer.from(await file.arrayBuffer())
  if (isSvg(file)) return { buffer: input, filename: file.name, contentType: "image/svg+xml" }
  try {
    const buffer = await sharp(input).rotate().resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
    return { buffer, filename: `${base(file.name)}.png`, contentType: "image/png" }
  } catch {
    throw new ApiError("INVALID_FILE")
  }
}

/** Image de partage : JPEG 1200×630 recadré au centre — lu par WhatsApp, iMessage, LinkedIn, Discord… */
export async function imageToShare(file: File): Promise<Converted> {
  const input = Buffer.from(await file.arrayBuffer())
  try {
    const buffer = await sharp(input).rotate().resize(1200, 630, { fit: "cover" }).flatten({ background: "#000000" }).jpeg({ quality: 88, mozjpeg: true }).toBuffer()
    return { buffer, filename: `${base(file.name)}.jpg`, contentType: "image/jpeg" }
  } catch {
    throw new ApiError("INVALID_FILE")
  }
}

/** Polices : WOFF2 / WOFF gardés, TTF / OTF compressés en WOFF2. */
export async function fontToWoff2(file: File): Promise<Converted> {
  const input = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split(".").pop()?.toLowerCase()
  if (ext === "woff2") return { buffer: input, filename: file.name, contentType: "font/woff2" }
  if (ext === "woff") return { buffer: input, filename: file.name, contentType: "font/woff" }
  if (ext !== "ttf" && ext !== "otf") throw new ApiError("INVALID_FILE")
  try {
    // @ts-expect-error wawoff2 n'a pas de types
    const { compress } = (await import("wawoff2")) as { compress: (b: Uint8Array) => Promise<Uint8Array> }
    const buffer = Buffer.from(await compress(input))
    return { buffer, filename: `${base(file.name)}.woff2`, contentType: "font/woff2" }
  } catch {
    throw new ApiError("INVALID_FILE")
  }
}

export async function asIs(file: File, contentType: string): Promise<Converted> {
  return { buffer: Buffer.from(await file.arrayBuffer()), filename: file.name, contentType }
}
