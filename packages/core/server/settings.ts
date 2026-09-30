import "server-only"
import { TAGLINE } from "@pbgo/binding"
import * as binding from "@pbgo/binding"
import { UI_TEXTS } from "@pbgo/studio-kit/constants"
import { revalidatePath, revalidateTag } from "next/cache"
import { DEFAULT_ERROR_MESSAGES } from "../lib/api"
import { AUDIO_QUERY, AUDIO_TAG, type AudioDoc, toSoundConfig } from "../lib/audio-server"
import { translate, type Localized } from "../lib/i18n"
import {
  clampPlayers,
  clampTimeout,
  cleanOptions,
  DEFAULT_THEME,
  isFont,
  isHex,
  mediaUrl,
  SETTINGS_FILE_SLOTS,
  SETTINGS_IMAGE_SLOTS,
  type SiteSettings,
  type ThemeColors,
  type UploadSlot,
  VISUAL_IMAGE_SLOTS,
  type VisualSlot,
} from "../lib/settings"
import { SETTINGS_QUERY, SETTINGS_TAG, type SettingsDoc, toSettings } from "../lib/settings-server"
import { DEFAULT_SKIN, mergeSkin, type Skin, type SkinDefaults } from "../lib/skin"
import { SKIN_QUERY, SKIN_TAG, type SkinDoc, toSkin } from "../lib/skin-server"
import { CODE_SOUNDS, DEFAULT_VOLUMES, type Volumes } from "../lib/sound-config"
import { client as readClient, sanityConfigure } from "../sanity/client"
import { writeClient } from "../sanity/write-client"
import { ApiError } from "./api"
import { asIs, type Converted, fontToWoff2, imageToIcon, imageToShare, imageToWebp } from "./convert"

/* ------------------------------------------------------------------ données de l'admin */

export type ImageInfo = { url: string | null; custom: boolean }

export type CopyGroup = "home" | "lobby" | "game" | "end" | "errors"
export type CopyEntry = { key: string; group: CopyGroup; label: string; value: string | null; fallback: string; multiline?: boolean }

export type AudioAdmin = {
  volumes: Volumes
  defaultMusic: string | null
  /** Morceaux enregistrés dans Sanity (sinon ceux du code, en lecture seule) */
  music: { key: string; title: string; url: string; loopEnd: number | null; stored: boolean }[]
  ambience: { url: string; loopEnd: number | null; stored: boolean } | null
  effects: { key: string; url: string | null; volume: number; codeVolume: number; stored: boolean }[]
  /** Fichiers du code pas encore envoyés dans Sanity */
  pendingImport: number
}

export type AdminData = {
  settings: SiteSettings
  /** Habillage effectif (Sanity + défauts du jeu) : sert aux aperçus */
  skin: Skin
  visual: { images: Record<VisualSlot, ImageInfo>; customColors: boolean }
  audio: AudioAdmin
  copy: { entries: CopyEntry[]; victoryPhrases: { value: string[] | null; fallback: string[] } }
  writable: boolean
}

const gameSkin = (binding as { DEFAULT_SKIN?: SkinDefaults }).DEFAULT_SKIN
const baseSkin = () => mergeSkin(DEFAULT_SKIN, gameSkin)

function reader() {
  return writeClient ?? readClient?.withConfig({ useCdn: false }) ?? null
}

function writer() {
  if (!writeClient) throw new ApiError(sanityConfigure ? "SANITY_TOKEN_MISSING" : "SANITY_NOT_CONFIGURED", 503)
  return writeClient
}

type TextsDoc = NonNullable<NonNullable<SkinDoc>["texts"]>

/** Libellés de fin de partie : rangés dans `ui_game` côté Sanity, affichés à part dans l'admin. */
const END_KEYS = ["winnerTitle", "showScores", "hideScores", "shareResult", "replay"]

function copyEntries(texts: TextsDoc | null | undefined, skin: Skin): CopyEntry[] {
  const fr = (v: unknown) => translate(v as Localized)?.trim() || null
  const base = baseSkin()
  const entries: CopyEntry[] = [
    { key: "tagline", group: "home", label: "Tagline", value: fr(texts?.tagline), fallback: TAGLINE, multiline: true },
    { key: "homeTitle", group: "home", label: "Intro title", value: fr(texts?.homeTitle), fallback: base.home.title ?? "" },
    { key: "homeIntro", group: "home", label: "Intro text (replaces the tagline)", value: fr(texts?.homeIntro), fallback: base.home.intro ?? "", multiline: true },
  ]
  for (const t of UI_TEXTS) {
    const stored = (texts?.[`ui_${t.group}`] as Record<string, unknown> | undefined)?.[t.key]
    entries.push({
      key: `ui.${t.key}`,
      group: t.group === "game" && END_KEYS.includes(t.key) ? "end" : t.group,
      label: t.title,
      value: fr(stored),
      fallback: base.texts[t.key],
    })
  }
  const stored = new Map((texts?.errorMessages ?? []).map((e) => [e.code, fr(e.message)]))
  for (const [code, message] of Object.entries(DEFAULT_ERROR_MESSAGES)) {
    entries.push({ key: `error.${code}`, group: "errors", label: code.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()), value: stored.get(code) ?? null, fallback: message })
  }
  void skin
  return entries
}

function audioAdmin(doc: AudioDoc): AudioAdmin {
  const url = (f: { url?: string | null } | null | undefined) => (f?.url ? mediaUrl(f.url) : null)
  const codeUrl = (file: string) => `/sounds/${file}.mp3`
  const effective = toSoundConfig(doc)
  const storedMusic = (doc?.music ?? []).filter((m) => m.key && url(m.file))
  const music = storedMusic.length
    ? storedMusic.map((m) => ({ key: m.key!, title: m.title || m.key!, url: url(m.file)!, loopEnd: m.loopEnd ?? null, stored: true }))
    : Object.entries(CODE_SOUNDS.music ?? {}).map(([key, m]) => ({ key, title: m.title ?? key, url: codeUrl(m.file), loopEnd: m.loopEnd, stored: false }))
  const ambienceUrl = url(doc?.ambience?.file)
  const ambience = ambienceUrl
    ? { url: ambienceUrl, loopEnd: doc?.ambience?.loopEnd ?? null, stored: true }
    : CODE_SOUNDS.ambience
      ? { url: codeUrl(CODE_SOUNDS.ambience.file), loopEnd: effective.ambience?.loopEnd ?? null, stored: false }
      : null
  const effects = Object.entries(CODE_SOUNDS.effects).map(([key, def]) => {
    const over = doc?.effects?.find((e) => e.key === key)
    const stored = url(over?.file)
    return { key, url: stored ?? codeUrl(def.file), volume: effective.effects[key]!.volume, codeVolume: def.volume, stored: !!stored }
  })
  const pendingImport = effects.filter((e) => !e.stored).length + (storedMusic.length ? 0 : music.length) + (ambience && !ambience.stored ? 1 : 0)
  return {
    volumes: { ...DEFAULT_VOLUMES, ...effective.volumes },
    defaultMusic: effective.defaultMusic ?? null,
    music,
    ambience,
    effects,
    pendingImport,
  }
}

export async function readAdminData(): Promise<AdminData> {
  const c = reader()
  // Sanity injoignable : l'admin s'affiche avec les valeurs par défaut (et reste en lecture seule si l'écriture échoue)
  const safe = <T,>(p: Promise<T> | undefined) => (p ? p.catch((e) => (console.error("Sanity (admin)", e), null)) : Promise.resolve(null))
  const [settingsDoc, skinDoc, audioDoc] = await Promise.all([
    safe(c?.fetch<SettingsDoc>(SETTINGS_QUERY)),
    safe(c?.fetch<SkinDoc>(SKIN_QUERY)),
    safe(c?.fetch<AudioDoc>(AUDIO_QUERY)),
  ])
  const partial = toSkin(skinDoc)
  const skin = mergeSkin(baseSkin(), partial)
  const images = Object.fromEntries(
    VISUAL_IMAGE_SLOTS.map((slot) => {
      const custom = !!(slot === "hostIcon" ? partial.hostIcon : partial.decor?.[DECOR_KEY[slot as Exclude<VisualSlot, "hostIcon">]])
      const value = slot === "hostIcon" ? skin.hostIcon : skin.decor[DECOR_KEY[slot as Exclude<VisualSlot, "hostIcon">]]
      return [slot, { url: typeof value === "string" ? value : (value?.url ?? null), custom }]
    }),
  ) as Record<VisualSlot, ImageInfo>
  const texts = skinDoc?.texts
  return {
    settings: toSettings(settingsDoc),
    skin,
    visual: { images, customColors: !!partial.playerColors },
    audio: audioAdmin(audioDoc),
    copy: {
      entries: copyEntries(texts, skin),
      victoryPhrases: { value: translate(texts?.victoryPhrases)?.filter((p) => p.trim()) || null, fallback: baseSkin().victoryPhrases },
    },
    writable: !!writeClient,
  }
}

const DECOR_KEY = { background: "background", pattern: "pattern", decorTop: "top", decorBottom: "bottom", hero: "hero" } as const

/* ------------------------------------------------------------------ enregistrement par page */

function refresh() {
  for (const tag of [SETTINGS_TAG, SKIN_TAG, AUDIO_TAG]) revalidateTag(tag, { expire: 0 })
  revalidatePath("/", "layout")
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const httpUrl = (v: unknown) => {
  const s = text(v, 500)
  if (!s) return null
  if (!/^https?:\/\/\S+$/.test(s)) throw new ApiError("INVALID_URL")
  return s
}

async function patchDoc(id: string, type: string, set: Record<string, unknown>, unset: string[] = [], setIfMissing: Record<string, unknown> = {}) {
  const c = writer()
  await c.createIfNotExists({ _id: id, _type: type })
  let p = c.patch(id)
  if (Object.keys(setIfMissing).length) p = p.setIfMissing(setIfMissing)
  if (Object.keys(set).length) p = p.set(set)
  if (unset.length) p = p.unset(unset)
  await p.commit()
}

/** Sépare les valeurs vides (à retirer) des autres (à écrire). */
function split(values: Record<string, unknown>) {
  const set: Record<string, unknown> = {}
  const unset: string[] = []
  for (const [k, v] of Object.entries(values)) {
    if (v === null || v === undefined || v === "") unset.push(k)
    else set[k] = v
  }
  return { set, unset }
}

export type SectionName = "identity" | "mechanics" | "visual" | "audio" | "copy"
export const SECTIONS: SectionName[] = ["identity", "mechanics", "visual", "audio", "copy"]

type Input = Record<string, unknown>

const SAVERS: Record<SectionName, (input: Input) => Promise<void>> = {
  async identity(input) {
    const s = input as Partial<SiteSettings>
    const title = text(s.title, 80)
    if (!title) throw new ApiError("EMPTY_TITLE")
    const { set, unset } = split({
      title,
      description: text(s.description, 400),
      creditsAuthors: text(s.credits?.authors, 240),
      publisher: text(s.credits?.publisher, 80),
      publisherUrl: httpUrl(s.credits?.publisherUrl),
    })
    await patchDoc("settings", "settings", set, unset)
  },

  async mechanics(input) {
    const s = input as Partial<SiteSettings> & { desktopOnly?: unknown }
    const options = cleanOptions(s.options)
    const { set, unset } = split({
      rulesPdfFr: httpUrl(s.rulesPdfLinks?.fr),
      rulesPdfEn: httpUrl(s.rulesPdfLinks?.en),
    })
    await patchDoc(
      "settings",
      "settings",
      {
        ...set,
        ...clampPlayers(s.minPlayers, s.maxPlayers),
        turnTimeout: clampTimeout(s.turnTimeout),
        gameOptions: { defaults: JSON.stringify(options.defaults), hidden: options.hidden },
      },
      unset,
    )
    if (typeof s.desktopOnly === "boolean") await patchDoc("interface", "interface", { desktopOnly: s.desktopOnly })
  },

  async visual(input) {
    const s = input as Partial<SiteSettings> & { playerColors?: unknown }
    const theme = Object.fromEntries(
      Object.keys(DEFAULT_THEME).map((k) => {
        const v = s.theme?.[k as keyof ThemeColors]
        if (!isHex(v)) throw new ApiError("INVALID_COLOR")
        return [k, v.toLowerCase()]
      }),
    )
    const { set, unset } = split({
      bodyFont: isFont(s.bodyFont) ? s.bodyFont : null,
      displayFont: isFont(s.displayFont) ? s.displayFont : null,
    })
    await patchDoc("settings", "settings", { ...set, theme }, unset)
    if (s.playerColors !== undefined) {
      const colors = Array.isArray(s.playerColors) ? s.playerColors.filter(isHex).map((c) => c.toLowerCase()).slice(0, 12) : []
      if (Array.isArray(s.playerColors) && colors.length !== s.playerColors.length) throw new ApiError("INVALID_COLOR")
      if (colors.length) await patchDoc("interface", "interface", { playerColors: colors })
      else await patchDoc("interface", "interface", {}, ["playerColors"])
    }
  },

  async audio(input) {
    const s = input as {
      volumes?: Partial<Volumes>
      defaultMusic?: unknown
      music?: { key?: unknown; title?: unknown; loopEnd?: unknown }[]
      ambienceLoopEnd?: unknown
      effects?: Record<string, unknown>
    }
    const num = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null)
    const c = writer()
    const current = await c.fetch<{ music?: { _key: string; key?: string }[]; effects?: { _key: string; key?: string }[] } | null>(
      `*[_id == "audio"][0]{ music[]{ _key, key }, effects[]{ _key, key } }`,
    )
    const set: Record<string, unknown> = {
      volumes: Object.fromEntries(Object.keys(DEFAULT_VOLUMES).map((k) => [k, num(s.volumes?.[k as keyof Volumes], 0, 1) ?? DEFAULT_VOLUMES[k as keyof Volumes]])),
    }
    const unset: string[] = []
    if (typeof s.defaultMusic === "string" && s.defaultMusic) set.defaultMusic = s.defaultMusic
    const loop = num(s.ambienceLoopEnd, 0.1, 3600)
    if (loop) set["ambience.loopEnd"] = loop
    // morceaux : ordre, titres et fins de boucle ; ceux absents de la liste sont retirés
    if (Array.isArray(s.music) && current?.music?.length) {
      const byKey = new Map(current.music.map((m) => [m.key, m]))
      const kept = s.music.filter((m) => typeof m.key === "string" && byKey.has(m.key))
      for (const m of current.music) if (!kept.some((k) => k.key === m.key)) unset.push(`music[_key=="${m._key}"]`)
      for (const m of kept) {
        const k = byKey.get(m.key as string)!._key
        set[`music[_key=="${k}"].title`] = text(m.title, 60) || (m.key as string)
        const end = num(m.loopEnd, 0.1, 3600)
        if (end) set[`music[_key=="${k}"].loopEnd`] = end
        else unset.push(`music[_key=="${k}"].loopEnd`)
      }
    }
    // volumes des effets : entrée créée si besoin (le fichier peut rester celui du code)
    const effects = [...(current?.effects ?? [])]
    const missing: { _key: string; _type: string; key: string; volume: number }[] = []
    for (const [key, v] of Object.entries(s.effects ?? {})) {
      if (!(key in CODE_SOUNDS.effects)) continue
      const vol = num(v, 0, 1)
      if (vol === null) continue
      const entry = effects.find((e) => e.key === key)
      if (entry) set[`effects[_key=="${entry._key}"].volume`] = vol
      else missing.push({ _key: key, _type: "audioEffect", key, volume: vol })
    }
    await c.createIfNotExists({ _id: "audio", _type: "audio" })
    let p = c.patch("audio").setIfMissing({ effects: [], ambience: { _type: "audioLoop" } })
    if (missing.length) p = p.append("effects", missing)
    await p.commit()
    let q = c.patch("audio").set(set)
    if (unset.length) q = q.unset(unset)
    await q.commit()
  },

  async copy(input) {
    const s = input as { values?: Record<string, unknown>; victoryPhrases?: unknown }
    const c = writer()
    const current = await c.fetch<{ errorMessages?: { code?: string; message?: Record<string, string> }[] } | null>(`*[_id == "texts"][0]{ errorMessages }`)
    const set: Record<string, unknown> = {}
    const unset: string[] = []
    const setIfMissing: Record<string, unknown> = {}
    const errors = new Map((current?.errorMessages ?? []).map((e) => [e.code, e.message ?? {}]))
    for (const [key, raw] of Object.entries(s.values ?? {})) {
      const value = text(raw, 600) || null
      if (key.startsWith("error.")) {
        const code = key.slice(6)
        if (!(code in DEFAULT_ERROR_MESSAGES)) continue
        const message: Record<string, string> = { ...(errors.get(code) ?? {}) }
        if (value) message.fr = value
        else delete message.fr
        errors.set(code, message)
        continue
      }
      let path: string
      if (key.startsWith("ui.")) {
        const t = UI_TEXTS.find((u) => u.key === key.slice(3))
        if (!t) continue
        path = `ui_${t.group}.${t.key}`
        setIfMissing[`ui_${t.group}`] = {}
      } else if (["tagline", "homeTitle", "homeIntro"].includes(key)) path = key
      else continue
      if (value) {
        setIfMissing[path] = { _type: key === "homeIntro" ? "localeText" : "localeString" }
        set[`${path}.fr`] = value
      } else unset.push(`${path}.fr`)
    }
    set.errorMessages = [...errors.entries()]
      .filter(([code, m]) => code && Object.values(m).some(Boolean))
      .map(([code, message]) => ({ _key: code, _type: "errorMessage", code, message: { _type: "localeString", ...message } }))
    if (s.victoryPhrases !== undefined) {
      const list = Array.isArray(s.victoryPhrases) ? s.victoryPhrases.map((p) => text(p, 120)).filter(Boolean) : []
      setIfMissing.victoryPhrases = { _type: "localeStringList" }
      if (list.length) set["victoryPhrases.fr"] = list
      else unset.push("victoryPhrases.fr")
    }
    await c.createIfNotExists({ _id: "texts", _type: "texts" })
    // les objets parents d'abord (setIfMissing), puis les valeurs
    const parents = Object.fromEntries(Object.entries(setIfMissing).filter(([k]) => !k.includes(".")))
    const children = Object.fromEntries(Object.entries(setIfMissing).filter(([k]) => k.includes(".")))
    await c.patch("texts").setIfMissing(parents).commit()
    let p = c.patch("texts").setIfMissing(children).set(set)
    if (unset.length) p = p.unset(unset)
    await p.commit()
  },
}

export const isSection = (v: string): v is SectionName => (SECTIONS as string[]).includes(v)

export async function saveSection(name: SectionName, input: Input) {
  await SAVERS[name](input)
  refresh()
  return readAdminData()
}

/* ------------------------------------------------------------------ fichiers */

// Vercel limite le corps des requêtes à ~4,5 Mo : au-delà, passer par le studio Sanity ou un lien
const MAX_UPLOAD = 4.4 * 1024 * 1024

type SlotConf = { doc: "settings" | "interface"; field: string; asset: "image" | "file"; convert: (f: File) => Promise<Converted> }

const image = (f: File) => f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(f.name)
const pdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name)

const SLOTS: Record<UploadSlot, SlotConf> = {
  logo: { doc: "settings", field: "logo", asset: "image", convert: imageToWebp },
  favicon: { doc: "settings", field: "favicon", asset: "image", convert: imageToIcon },
  shareImage: { doc: "settings", field: "shareImage", asset: "image", convert: imageToShare },
  rulesFr: { doc: "settings", field: "rulesPdfFrFile", asset: "file", convert: (f) => asIs(f, "application/pdf") },
  rulesEn: { doc: "settings", field: "rulesPdfEnFile", asset: "file", convert: (f) => asIs(f, "application/pdf") },
  fontBody: { doc: "settings", field: "bodyFontFile", asset: "file", convert: fontToWoff2 },
  fontDisplay: { doc: "settings", field: "displayFontFile", asset: "file", convert: fontToWoff2 },
  background: { doc: "interface", field: "background", asset: "image", convert: imageToWebp },
  pattern: { doc: "interface", field: "pattern", asset: "image", convert: imageToWebp },
  decorTop: { doc: "interface", field: "decorTop", asset: "image", convert: imageToWebp },
  decorBottom: { doc: "interface", field: "decorBottom", asset: "image", convert: imageToWebp },
  hero: { doc: "interface", field: "hero", asset: "image", convert: imageToWebp },
  hostIcon: { doc: "interface", field: "hostIcon", asset: "image", convert: imageToWebp },
}

void SETTINGS_FILE_SLOTS
void SETTINGS_IMAGE_SLOTS

/** Sons : `audio.effect.<clé>`, `audio.music.<clé>` (remplace), `audio.music.new` (ajoute), `audio.ambience`. */
const AUDIO_SLOT = /^audio\.(effect|music)\.([a-zA-Z0-9_-]{1,40})$|^audio\.ambience$/

export const isUploadSlot = (v: string) => v in SLOTS || AUDIO_SLOT.test(v)

function accepts(slot: string, file: File) {
  if (slot.startsWith("audio.")) return file.type === "audio/mpeg" || /\.mp3$/i.test(file.name)
  if (slot === "rulesFr" || slot === "rulesEn") return pdf(file)
  if (slot === "fontBody" || slot === "fontDisplay") return /\.(woff2?|ttf|otf)$/i.test(file.name)
  return image(file)
}

const slug = (name: string) =>
  name
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "track"

async function uploadAudio(slot: string, buffer: Buffer, filename: string, title?: string) {
  const c = writer()
  const asset = await c.assets.upload("file", buffer, { filename, contentType: "audio/mpeg" })
  const file = { _type: "file", asset: { _type: "reference", _ref: asset._id } }
  await c.createIfNotExists({ _id: "audio", _type: "audio" })
  if (slot === "audio.ambience") {
    await c.patch("audio").setIfMissing({ ambience: { _type: "audioLoop" } }).set({ "ambience.file": file }).commit()
    return
  }
  const [, kind, key] = slot.split(".") as [string, "effect" | "music", string]
  const list = kind === "effect" ? "effects" : "music"
  const current = await c.fetch<{ _key: string; key?: string }[] | null>(`*[_id == "audio"][0].${list}[]{ _key, key }`)
  const existing = key === "new" ? undefined : current?.find((e) => e.key === key)
  if (existing) {
    await c.patch("audio").set({ [`${list}[_key=="${existing._key}"].file`]: file }).commit()
    return
  }
  if (kind === "effect" && !(key in CODE_SOUNDS.effects)) throw new ApiError("INVALID_REQUEST", 404)
  let newKey = key === "new" ? slug(filename) : key
  while (current?.some((e) => e.key === newKey)) newKey = `${newKey}-2`
  const entry =
    kind === "effect"
      ? { _key: newKey, _type: "audioEffect", key: newKey, file }
      : { _key: newKey, _type: "audioTrack", key: newKey, title: title ?? newKey, file }
  await c.patch("audio").setIfMissing({ [list]: [] }).append(list, [entry]).commit()
}

export async function uploadAsset(slot: string, file: File) {
  if (!isUploadSlot(slot)) throw new ApiError("INVALID_REQUEST", 404)
  if (!accepts(slot, file)) throw new ApiError("INVALID_FILE")
  if (file.size > MAX_UPLOAD) throw new ApiError("FILE_TOO_LARGE")
  if (slot.startsWith("audio.")) {
    await uploadAudio(slot, Buffer.from(await file.arrayBuffer()), file.name, file.name.replace(/\.[^.]+$/, ""))
  } else {
    const conf = SLOTS[slot as UploadSlot]
    const converted = await conf.convert(file)
    const c = writer()
    const asset = await c.assets.upload(conf.asset, converted.buffer, { filename: converted.filename, contentType: converted.contentType })
    await patchDoc(conf.doc, conf.doc, { [conf.field]: { _type: conf.asset, asset: { _type: "reference", _ref: asset._id } } })
  }
  refresh()
  return readAdminData()
}

export async function removeAsset(slot: string) {
  if (!isUploadSlot(slot)) throw new ApiError("INVALID_REQUEST", 404)
  if (slot.startsWith("audio.")) {
    const c = writer()
    if (slot === "audio.ambience") await c.patch("audio").unset(["ambience.file"]).commit()
    else {
      const [, kind, key] = slot.split(".") as [string, "effect" | "music", string]
      const list = kind === "effect" ? "effects" : "music"
      const entry = (await c.fetch<{ _key: string; key?: string }[] | null>(`*[_id == "audio"][0].${list}[]{ _key, key }`))?.find((e) => e.key === key)
      if (entry) await c.patch("audio").unset([kind === "effect" ? `${list}[_key=="${entry._key}"].file` : `${list}[_key=="${entry._key}"]`]).commit()
    }
  } else {
    const conf = SLOTS[slot as UploadSlot]
    await patchDoc(conf.doc, conf.doc, {}, [conf.field])
  }
  refresh()
  return readAdminData()
}

/**
 * Envoie dans Sanity les sons encore servis depuis /public/sounds (effets, musiques, ambiance), en gardant clés, titres,
 * volumes et fins de boucle. Relançable : ce qui est déjà dans Sanity est ignoré.
 */
export async function importCodeSounds(origin: string) {
  const data = await readAdminData()
  const get = async (url: string) => {
    const res = await fetch(new URL(url, origin))
    if (!res.ok) throw new ApiError("SOUND_NOT_FOUND", 502)
    return Buffer.from(await res.arrayBuffer())
  }
  for (const e of data.audio.effects.filter((x) => !x.stored)) {
    await uploadAudio(`audio.effect.${e.key}`, await get(e.url!), `${e.key}.mp3`)
  }
  if (!data.audio.music.some((m) => m.stored)) {
    for (const m of data.audio.music) await uploadAudio(`audio.music.${m.key}`, await get(m.url), `${m.key}.mp3`, m.title)
    const c = writer()
    const keys = await c.fetch<{ _key: string; key: string }[]>(`*[_id == "audio"][0].music[]{ _key, key }`)
    const set: Record<string, unknown> = {}
    for (const m of data.audio.music) {
      const k = keys.find((x) => x.key === m.key)?._key
      if (k && m.loopEnd) set[`music[_key=="${k}"].loopEnd`] = m.loopEnd
    }
    if (data.audio.defaultMusic) set.defaultMusic = data.audio.defaultMusic
    if (Object.keys(set).length) await c.patch("audio").set(set).commit()
  }
  if (data.audio.ambience && !data.audio.ambience.stored) {
    await uploadAudio("audio.ambience", await get(data.audio.ambience.url), "ambience.mp3")
    if (data.audio.ambience.loopEnd) await writer().patch("audio").set({ "ambience.loopEnd": data.audio.ambience.loopEnd }).commit()
  }
  refresh()
  return readAdminData()
}

/* ------------------------------------------------------------------ compatibilité (anciennes routes) */

export async function readSettingsFresh(): Promise<SiteSettings> {
  return (await readAdminData()).settings
}
