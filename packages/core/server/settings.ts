import "server-only"
import { revalidatePath, revalidateTag } from "next/cache"
import { SETTINGS_QUERY, SETTINGS_TAG, type SettingsDoc, toSettings } from "../lib/settings-server"
import { clampPlayers, DEFAULT_THEME, isFont, isHex, type SiteSettings, type ThemeColors, type UploadSlot } from "../lib/settings"
import { sanityConfigure } from "../sanity/client"
import { writeClient } from "../sanity/write-client"
import { ApiError } from "./api"

const DOC_ID = "settings"

function client() {
  if (!writeClient) throw new ApiError(sanityConfigure ? "SANITY_TOKEN_MISSING" : "SANITY_NOT_CONFIGURED", 503)
  return writeClient
}

export async function readSettingsFresh(): Promise<SiteSettings> {
  return toSettings(await client().fetch<SettingsDoc>(SETTINGS_QUERY))
}

function refresh() {
  revalidateTag(SETTINGS_TAG, { expire: 0 })
  revalidatePath("/", "layout")
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const httpUrl = (v: unknown) => {
  const s = text(v, 500)
  if (!s) return null
  if (!/^https?:\/\/\S+$/.test(s)) throw new ApiError("INVALID_URL")
  return s
}

export async function saveSettings(input: Partial<SiteSettings>) {
  const theme = Object.fromEntries(
    Object.keys(DEFAULT_THEME).map((k) => {
      const v = input.theme?.[k as keyof ThemeColors]
      if (!isHex(v)) throw new ApiError("INVALID_COLOR")
      return [k, v.toLowerCase()]
    }),
  )
  const set: Record<string, unknown> = {
    title: text(input.title, 80),
    description: text(input.description, 400),
    ...clampPlayers(input.minPlayers, input.maxPlayers),
    theme,
  }
  const unset: string[] = []
  const optional: Record<string, string | null> = {
    bodyFont: isFont(input.bodyFont) ? input.bodyFont : null,
    displayFont: isFont(input.displayFont) ? input.displayFont : null,
    rulesPdfFr: httpUrl(input.rulesPdfLinks?.fr),
    rulesPdfEn: httpUrl(input.rulesPdfLinks?.en),
    creditsAuthors: text(input.credits?.authors, 240) || null,
    publisher: text(input.credits?.publisher, 80) || null,
    publisherUrl: httpUrl(input.credits?.publisherUrl),
  }
  for (const [k, v] of Object.entries(optional)) {
    if (v) set[k] = v
    else unset.push(k)
  }
  if (!set.title) throw new ApiError("EMPTY_TITLE")
  const c = client()
  await c.createIfNotExists({ _id: DOC_ID, _type: "settings" })
  await c.patch(DOC_ID).set(set).unset(unset).commit()
  refresh()
  return readSettingsFresh()
}

// Vercel limite le corps des requêtes à ~4,5 Mo : au-delà, passer par le studio Sanity ou un lien
const MAX_UPLOAD = 4.4 * 1024 * 1024

const SLOTS: Record<UploadSlot, { field: string; asset: "image" | "file"; accepts: (f: File) => boolean }> = {
  logo: { field: "logo", asset: "image", accepts: (f) => f.type.startsWith("image/") },
  rulesFr: { field: "rulesPdfFrFile", asset: "file", accepts: (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name) },
  rulesEn: { field: "rulesPdfEnFile", asset: "file", accepts: (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name) },
  fontBody: { field: "bodyFontFile", asset: "file", accepts: (f) => /\.(woff2?|ttf|otf)$/i.test(f.name) },
  fontDisplay: { field: "displayFontFile", asset: "file", accepts: (f) => /\.(woff2?|ttf|otf)$/i.test(f.name) },
}

export const isUploadSlot = (v: string): v is UploadSlot => v in SLOTS

export async function uploadAsset(slot: UploadSlot, file: File) {
  const conf = SLOTS[slot]
  if (!conf.accepts(file)) throw new ApiError("INVALID_FILE")
  if (file.size > MAX_UPLOAD) throw new ApiError("FILE_TOO_LARGE")
  const c = client()
  const asset = await c.assets.upload(conf.asset, Buffer.from(await file.arrayBuffer()), {
    filename: file.name,
    contentType: file.type || "application/octet-stream",
  })
  await c.createIfNotExists({ _id: DOC_ID, _type: "settings" })
  await c
    .patch(DOC_ID)
    .set({ [conf.field]: { _type: conf.asset, asset: { _type: "reference", _ref: asset._id } } })
    .commit()
  refresh()
  return readSettingsFresh()
}

export async function removeAsset(slot: UploadSlot) {
  const c = client()
  await c.createIfNotExists({ _id: DOC_ID, _type: "settings" })
  await c.patch(DOC_ID).unset([SLOTS[slot].field]).commit()
  refresh()
  return readSettingsFresh()
}
