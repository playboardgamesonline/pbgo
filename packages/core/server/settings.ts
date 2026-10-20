import "server-only"
import { UI_TEXTS } from "@pbgo/studio-kit/constants"
import { revalidatePath, revalidateTag } from "next/cache"
import { errorMessages } from "../lib/api"
import { audioQuery, audioTag, type AudioDoc, toSoundConfig } from "../lib/audio-server"
import type { GameBinding, GameModule } from "../lib/binding"
import { LOCALES, type Locale, type Localized } from "../lib/i18n"
import {
  byLocale,
  clampPlayers,
  clampTimeout,
  cleanOptions,
  defaultTheme,
  isFont,
  isHex,
  mediaUrl,
  RULES_FIELD,
  type SiteSettings,
  type ThemeColors,
  type UploadSlot,
  VISUAL_IMAGE_SLOTS,
  type VisualSlot,
} from "../lib/settings"
import { settingsQuery, settingsTag, type SettingsDoc, toSettings } from "../lib/settings-server"
import { baseSkin, gameI18n, mergeSkin, type Skin } from "../lib/skin"
import { type SkinDoc, skinQuery, skinTag, toSkin } from "../lib/skin-server"
import { codeSounds, DEFAULT_VOLUMES, soundUrl, type Volumes } from "../lib/sound-config"
import { sanityClient, sanityConfigured } from "../sanity/client"
import { sanityWritable, writeClient } from "../sanity/write-client"
import { ApiError } from "./api"
import { asIs, type Converted, fontToWoff2, imageToIcon, imageToShare, imageToWebp } from "./convert"
import { DOCS, type DocName, draftState, type DraftState, eachVersion, fetchDoc, RAW_PERSPECTIVE, readId, readVersions } from "./sanity-docs"

/* ------------------------------------------------------------------ admin data */

export type ImageInfo = { url: string | null; custom: boolean }

export type CopyGroup = "home" | "lobby" | "game" | "end" | "errors"
/** An editable text: the value entered (or null) and the default text, for each language */
export type CopyEntry = { key: string; group: CopyGroup; label: string; values: Record<Locale, string | null>; fallbacks: Record<Locale, string>; multiline?: boolean }

export type AudioAdmin = {
  volumes: Volumes
  defaultMusic: string | null
  /** Tracks stored in Sanity (else the game's own, read-only) */
  music: { key: string; title: string; url: string; loopEnd: number | null; stored: boolean }[]
  ambience: { url: string; loopEnd: number | null; stored: boolean } | null
  effects: { key: string; url: string | null; volume: number; codeVolume: number; stored: boolean }[]
  /** Files of the game not sent to Sanity yet */
  pendingImport: number
}

export type AdminData = {
  settings: SiteSettings
  /** Effective skin (Sanity + the game's defaults): feeds the previews */
  skin: Skin
  visual: { images: Record<VisualSlot, ImageInfo>; customColors: boolean }
  audio: AudioAdmin
  copy: { entries: CopyEntry[]; victoryPhrases: { values: Record<Locale, string[] | null>; fallbacks: Record<Locale, string[]> } }
  writable: boolean
  /** Documents the Studio holds a draft of that the admin does not simply follow: older than the published one ("stale") or never published ("unpublished") */
  drafts: Partial<Record<DocName, DraftState>>
}

/** Uncached reads of the game's Sanity project (the write client when there is a token). */
function reader(game: GameModule) {
  return writeClient(game) ?? sanityClient(game)?.withConfig({ useCdn: false }) ?? null
}

function writer(game: GameModule) {
  const c = writeClient(game)
  if (!c) throw new ApiError(sanityConfigured(game) ? "SANITY_TOKEN_MISSING" : "SANITY_NOT_CONFIGURED", 503)
  return c
}

type TextsDoc = NonNullable<NonNullable<SkinDoc>["texts"]>

/** End of game labels: stored in `ui_game` in Sanity, shown apart in the admin. */
const END_KEYS = ["winnerTitle", "showScores", "hideScores", "scoreboard", "shareResult", "replay"]

const gameTagline = (binding: GameBinding, l: Locale) =>
  l === "fr" ? binding.TAGLINE : ((gameI18n(binding)[l]?.skin?.home?.tagline as string | undefined) ?? binding.TAGLINE)

/** Value entered in one language (no fallback: empty = default text of that language). */
const stored = (v: unknown, l: Locale) => {
  const x = (v as Localized)?.[l]
  return typeof x === "string" && x.trim() ? x.trim() : null
}

function copyEntries(binding: GameBinding, texts: TextsDoc | null | undefined): CopyEntry[] {
  const bases = byLocale((l) => baseSkin(binding, l))
  const defaults = errorMessages(binding)
  const values = (v: unknown) => byLocale((l) => stored(v, l))
  const entries: CopyEntry[] = [
    { key: "tagline", group: "home", label: "Tagline", values: values(texts?.tagline), fallbacks: byLocale((l) => gameTagline(binding, l)), multiline: true },
    { key: "homeTitle", group: "home", label: "Intro title", values: values(texts?.homeTitle), fallbacks: byLocale((l) => bases[l].home.title ?? "") },
    { key: "homeIntro", group: "home", label: "Intro text (replaces the tagline)", values: values(texts?.homeIntro), fallbacks: byLocale((l) => bases[l].home.intro ?? ""), multiline: true },
  ]
  for (const t of UI_TEXTS) {
    const raw = (texts?.[`ui_${t.group}`] as Record<string, unknown> | undefined)?.[t.key]
    entries.push({
      key: `ui.${t.key}`,
      group: t.group === "game" && END_KEYS.includes(t.key) ? "end" : t.group,
      label: t.title,
      values: values(raw),
      fallbacks: byLocale((l) => bases[l].texts[t.key]),
    })
  }
  const errors = new Map((texts?.errorMessages ?? []).map((e) => [e.code, e.message]))
  for (const code of Object.keys(defaults)) {
    entries.push({
      key: `error.${code}`,
      group: "errors",
      label: code.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
      values: values(errors.get(code)),
      fallbacks: byLocale((l) => bases[l].errors[code] ?? defaults[code]!),
    })
  }
  return entries
}

function audioAdmin(game: GameModule, doc: AudioDoc): AudioAdmin {
  const url = (f: { url?: string | null } | null | undefined) => (f?.url ? mediaUrl(f.url) : null)
  const codeUrl = (file: string) => soundUrl(game.slug, { file })
  const code = codeSounds(game.binding)
  const effective = toSoundConfig(doc, code)
  const storedMusic = (doc?.music ?? []).filter((m) => m.key && url(m.file))
  const music = storedMusic.length
    ? storedMusic.map((m) => ({ key: m.key!, title: m.title || m.key!, url: url(m.file)!, loopEnd: m.loopEnd ?? null, stored: true }))
    : Object.entries(code.music ?? {}).map(([key, m]) => ({ key, title: m.title ?? key, url: codeUrl(m.file), loopEnd: m.loopEnd, stored: false }))
  const ambienceUrl = url(doc?.ambience?.file)
  const ambience = ambienceUrl
    ? { url: ambienceUrl, loopEnd: doc?.ambience?.loopEnd ?? null, stored: true }
    : code.ambience
      ? { url: codeUrl(code.ambience.file), loopEnd: effective.ambience?.loopEnd ?? null, stored: false }
      : null
  const effects = Object.entries(code.effects).map(([key, def]) => {
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

export async function readAdminData(game: GameModule): Promise<AdminData> {
  const c = reader(game)
  // Sanity unreachable: the admin shows the default values (and stays read-only if writing fails)
  const safe = <T,>(p: Promise<T> | undefined) => (p ? p.catch((e) => (console.error("Sanity (admin)", e), null)) : Promise.resolve(null))
  // The admin shows what the Studio shows: the draft of a document when it has a fresh one, else the published document
  const versions = await safe(c ? readVersions(c, DOCS) : undefined)
  const at = (id: DocName) => readId(id, versions?.[id])
  const [settingsDoc, skinDoc, audioDoc] = await Promise.all([
    safe(c?.fetch<SettingsDoc>(settingsQuery(at("settings")), {}, RAW_PERSPECTIVE)),
    safe(c?.fetch<SkinDoc>(skinQuery({ interface: at("interface"), texts: at("texts") }), {}, RAW_PERSPECTIVE)),
    safe(c?.fetch<AudioDoc>(audioQuery(at("audio")), {}, RAW_PERSPECTIVE)),
  ])
  const partial = toSkin(game, skinDoc)
  const skin = mergeSkin(baseSkin(game.binding, "fr"), partial)
  const images = Object.fromEntries(
    VISUAL_IMAGE_SLOTS.map((slot) => {
      const custom = !!(slot === "hostIcon" ? partial.hostIcon : partial.decor?.[DECOR_KEY[slot as Exclude<VisualSlot, "hostIcon">]])
      const value = slot === "hostIcon" ? skin.hostIcon : skin.decor[DECOR_KEY[slot as Exclude<VisualSlot, "hostIcon">]]
      return [slot, { url: typeof value === "string" ? value : (value?.url ?? null), custom }]
    }),
  ) as Record<VisualSlot, ImageInfo>
  const texts = skinDoc?.texts
  const drafts: AdminData["drafts"] = {}
  for (const id of DOCS) {
    const state = draftState(versions?.[id])
    if (state) drafts[id] = state
  }
  return {
    settings: toSettings(game, settingsDoc),
    skin,
    visual: { images, customColors: !!partial.playerColors },
    audio: audioAdmin(game, audioDoc),
    copy: {
      entries: copyEntries(game.binding, texts),
      victoryPhrases: {
        values: byLocale((l) => {
          const list = (texts?.victoryPhrases as Localized<string[]>)?.[l]?.filter((p) => p.trim())
          return list?.length ? list : null
        }),
        fallbacks: byLocale((l) => baseSkin(game.binding, l).victoryPhrases),
      },
    },
    writable: sanityWritable(game),
    drafts,
  }
}

const DECOR_KEY = { background: "background", pattern: "pattern", decorTop: "top", decorBottom: "bottom", hero: "hero" } as const

/* ------------------------------------------------------------------ saving, one section at a time */

/** Fresh Sanity data on the game's pages after a save (the other games keep their cache). */
function refresh(slug: string) {
  for (const tag of [settingsTag(slug), skinTag(slug), audioTag(slug)]) revalidateTag(tag, { expire: 0 })
  revalidatePath(`/${slug}`, "layout")
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const httpUrl = (v: unknown) => {
  const s = text(v, 500)
  if (!s) return null
  if (!/^https?:\/\/\S+$/.test(s)) throw new ApiError("INVALID_URL")
  return s
}

type DocPatch = { setIfMissing?: Record<string, unknown>; set?: Record<string, unknown>; unset?: string[] }

const isEmpty = (o: object | undefined) => !o || !Object.keys(o).length

/**
 * Applies the patches, one after the other, to every version of the document that the save must reach (`eachVersion`: its published
 * document and the draft the Studio shows, in one transaction). A path whose parent object may not exist yet goes in the patch
 * after the one that creates the parent: the operations of one patch have an order of their own. An edit that only removes
 * things never creates the document.
 */
async function patchDoc(game: GameModule, id: DocName, ...patches: DocPatch[]) {
  const c = writer(game)
  const steps = patches.filter((p) => !isEmpty(p.setIfMissing) || !isEmpty(p.set) || p.unset?.length)
  await eachVersion(
    c,
    id,
    (target, tx) => {
      for (const step of steps) {
        tx.patch(target, (p) => {
          if (!isEmpty(step.setIfMissing)) p = p.setIfMissing(step.setIfMissing!)
          if (!isEmpty(step.set)) p = p.set(step.set!)
          if (step.unset?.length) p = p.unset(step.unset)
          return p
        })
      }
    },
    { create: steps.some((p) => !isEmpty(p.setIfMissing) || !isEmpty(p.set)) },
  )
}

type Keyed = { _key: string; key?: string }

/** The `_key` and `key` of the entries of a list of the audio document (tracks or effects), as the version `target` of it holds them. */
async function keysOf(c: ReturnType<typeof writer>, target: string, list: "music" | "effects"): Promise<Keyed[]> {
  return (await fetchDoc<Record<string, Keyed[] | null>>(c, target, `{ ${list}[]{ _key, key } }`))?.[list] ?? []
}

/** Splits the empty values (to remove) from the others (to write). */
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

const SAVERS: Record<SectionName, (game: GameModule, input: Input) => Promise<void>> = {
  async identity(game, input) {
    const s = input as Partial<SiteSettings>
    const title = text(s.title, 80)
    if (!title) throw new ApiError("EMPTY_TITLE")
    const descriptions = (input.descriptions ?? {}) as Partial<Record<Locale, unknown>>
    const authors = (input.creditsAuthors ?? {}) as Partial<Record<Locale, unknown>>
    const { set, unset } = split({
      title,
      description: text(descriptions.fr, 400),
      creditsAuthors: text(authors.fr, 240),
      ...Object.fromEntries(LOCALES.flatMap((l) => [[`descriptionI18n.${l}`, text(descriptions[l], 400)], [`creditsAuthorsI18n.${l}`, text(authors[l], 240)]])),
      publisher: text(s.credits?.publisher, 80),
      publisherUrl: httpUrl(s.credits?.publisherUrl),
    })
    await patchDoc(game, "settings", { setIfMissing: { descriptionI18n: { _type: "localeText" }, creditsAuthorsI18n: { _type: "localeString" } } }, { set, unset })
  },

  async mechanics(game, input) {
    const s = input as Partial<SiteSettings> & { desktopOnly?: unknown }
    const options = cleanOptions(game.binding, s.options)
    const { set, unset } = split(Object.fromEntries(LOCALES.map((l) => [RULES_FIELD[l], httpUrl(s.rulesPdfLinks?.[l])])))
    await patchDoc(game, "settings", {
      set: {
        ...set,
        ...clampPlayers(game.binding, s.minPlayers, s.maxPlayers),
        turnTimeout: clampTimeout(s.turnTimeout),
        gameOptions: { defaults: JSON.stringify(options.defaults), hidden: options.hidden },
      },
      unset,
    })
    if (typeof s.desktopOnly === "boolean") await patchDoc(game, "interface", { set: { desktopOnly: s.desktopOnly } })
  },

  async visual(game, input) {
    const s = input as Partial<SiteSettings> & { playerColors?: unknown }
    const theme = Object.fromEntries(
      Object.keys(defaultTheme(game.binding)).map((k) => {
        const v = s.theme?.[k as keyof ThemeColors]
        if (!isHex(v)) throw new ApiError("INVALID_COLOR")
        return [k, v.toLowerCase()]
      }),
    )
    const { set, unset } = split({
      bodyFont: isFont(s.bodyFont) ? s.bodyFont : null,
      displayFont: isFont(s.displayFont) ? s.displayFont : null,
    })
    // Every colour is checked before the first write: a refused save leaves both documents as they were
    let colors: string[] | null = null
    if (s.playerColors !== undefined) {
      colors = Array.isArray(s.playerColors) ? s.playerColors.filter(isHex).map((c) => c.toLowerCase()).slice(0, 12) : []
      if (Array.isArray(s.playerColors) && colors.length !== s.playerColors.length) throw new ApiError("INVALID_COLOR")
    }
    await patchDoc(game, "settings", { set: { ...set, theme }, unset })
    if (colors?.length) await patchDoc(game, "interface", { set: { playerColors: colors } })
    else if (colors) await patchDoc(game, "interface", { unset: ["playerColors"] })
  },

  async audio(game, input) {
    const s = input as {
      volumes?: Partial<Volumes>
      defaultMusic?: unknown
      music?: { key?: unknown; title?: unknown; loopEnd?: unknown }[]
      ambienceLoopEnd?: unknown
      effects?: Record<string, unknown>
    }
    const num = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null)
    const c = writer(game)
    const codeEffects = codeSounds(game.binding).effects
    const volumes = Object.fromEntries(Object.keys(DEFAULT_VOLUMES).map((k) => [k, num(s.volumes?.[k as keyof Volumes], 0, 1) ?? DEFAULT_VOLUMES[k as keyof Volumes]]))
    const loop = num(s.ambienceLoopEnd, 0.1, 3600)
    // The tracks and effects are addressed by `_key`, which is not the same in the published document and in its draft: each version is read and patched on its own
    await eachVersion(c, "audio", async (target, tx) => {
      const current = await fetchDoc<{ music?: Keyed[]; effects?: Keyed[] }>(c, target, "{ music[]{ _key, key }, effects[]{ _key, key } }")
      const set: Record<string, unknown> = { volumes }
      const unset: string[] = []
      if (typeof s.defaultMusic === "string" && s.defaultMusic) set.defaultMusic = s.defaultMusic
      if (loop) set["ambience.loopEnd"] = loop
      // tracks: order, titles and loop ends; the ones missing from the list are removed
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
      // effect volumes: the entry is created when needed (the file can stay the game's own)
      const effects = current?.effects ?? []
      const missing: { _key: string; _type: string; key: string; volume: number }[] = []
      for (const [key, v] of Object.entries(s.effects ?? {})) {
        if (!(key in codeEffects)) continue
        const vol = num(v, 0, 1)
        if (vol === null) continue
        const entry = effects.find((e) => e.key === key)
        if (entry) set[`effects[_key=="${entry._key}"].volume`] = vol
        else missing.push({ _key: key, _type: "audioEffect", key, volume: vol })
      }
      // the lists and the loop first, then the entries added to them, then the values
      tx.patch(target, (p) => p.setIfMissing({ effects: [], ambience: { _type: "audioLoop" } }))
      if (missing.length) tx.patch(target, (p) => p.append("effects", missing))
      tx.patch(target, (p) => (unset.length ? p.set(set).unset(unset) : p.set(set)))
    })
  },

  async copy(game, input) {
    const s = input as { values?: Record<string, Partial<Record<Locale, unknown>>>; victoryPhrases?: Partial<Record<Locale, unknown>> }
    const c = writer(game)
    const codes = errorMessages(game.binding)
    const set: Record<string, unknown> = {}
    const unset: string[] = []
    const setIfMissing: Record<string, unknown> = {}
    const errorEdits: { code: string; locale: Locale; value: string | null }[] = []
    for (const [key, byLang] of Object.entries(s.values ?? {})) {
      for (const l of LOCALES) {
        if (!(byLang && l in byLang)) continue
        const value = text(byLang[l], 600) || null
        if (key.startsWith("error.")) {
          const code = key.slice(6)
          if (code in codes) errorEdits.push({ code, locale: l, value })
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
          set[`${path}.${l}`] = value
        } else unset.push(`${path}.${l}`)
      }
    }
    if (s.victoryPhrases) {
      setIfMissing.victoryPhrases = { _type: "localeStringList" }
      for (const l of LOCALES) {
        if (!(l in s.victoryPhrases)) continue
        const raw = s.victoryPhrases[l]
        const list = Array.isArray(raw) ? raw.map((p) => text(p, 120)).filter(Boolean) : []
        if (list.length) set[`victoryPhrases.${l}`] = list
        else unset.push(`victoryPhrases.${l}`)
      }
    }
    const parents = Object.fromEntries(Object.entries(setIfMissing).filter(([k]) => !k.includes(".")))
    const children = Object.fromEntries(Object.entries(setIfMissing).filter(([k]) => k.includes(".")))
    await eachVersion(c, "texts", async (target, tx) => {
      // the error messages are one list, written whole: from what this version holds now
      const current = await fetchDoc<{ errorMessages?: { code?: string; message?: Record<string, string> }[] }>(c, target, "{ errorMessages }")
      const errors = new Map((current?.errorMessages ?? []).map((e) => [e.code, e.message ?? {}]))
      for (const { code, locale, value } of errorEdits) {
        const message: Record<string, string> = { ...(errors.get(code) ?? {}) }
        if (value) message[locale] = value
        else delete message[locale]
        errors.set(code, message)
      }
      const messages = [...errors.entries()]
        .filter(([code, m]) => code && Object.values(m).some(Boolean))
        .map(([code, message]) => ({ _key: code, _type: "errorMessage", code, message: { _type: "localeString", ...message } }))
      // parent objects first (setIfMissing), then the values
      if (!isEmpty(parents)) tx.patch(target, (p) => p.setIfMissing(parents))
      tx.patch(target, (p) => {
        const q = isEmpty(children) ? p : p.setIfMissing(children)
        const r = q.set({ ...set, errorMessages: messages })
        return unset.length ? r.unset(unset) : r
      })
    })
  },
}

export const isSection = (v: string): v is SectionName => (SECTIONS as string[]).includes(v)

export async function saveSection(game: GameModule, name: SectionName, input: Input) {
  await SAVERS[name](game, input)
  refresh(game.slug)
  return readAdminData(game)
}

/* ------------------------------------------------------------------ files */

// Vercel caps request bodies at ~4.5 MB: beyond that, go through the Sanity studio or a link
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
  rulesEs: { doc: "settings", field: "rulesPdfEsFile", asset: "file", convert: (f) => asIs(f, "application/pdf") },
  rulesDe: { doc: "settings", field: "rulesPdfDeFile", asset: "file", convert: (f) => asIs(f, "application/pdf") },
  fontBody: { doc: "settings", field: "bodyFontFile", asset: "file", convert: fontToWoff2 },
  fontDisplay: { doc: "settings", field: "displayFontFile", asset: "file", convert: fontToWoff2 },
  background: { doc: "interface", field: "background", asset: "image", convert: imageToWebp },
  pattern: { doc: "interface", field: "pattern", asset: "image", convert: imageToWebp },
  decorTop: { doc: "interface", field: "decorTop", asset: "image", convert: imageToWebp },
  decorBottom: { doc: "interface", field: "decorBottom", asset: "image", convert: imageToWebp },
  hero: { doc: "interface", field: "hero", asset: "image", convert: imageToWebp },
  hostIcon: { doc: "interface", field: "hostIcon", asset: "image", convert: imageToWebp },
}

/** Sounds: `audio.effect.<key>`, `audio.music.<key>` (replaces), `audio.music.new` (adds), `audio.ambience`. */
const AUDIO_SLOT = /^audio\.(effect|music)\.([a-zA-Z0-9_-]{1,40})$|^audio\.ambience$/

export const isUploadSlot = (v: string) => v in SLOTS || AUDIO_SLOT.test(v)

function accepts(slot: string, file: File) {
  if (slot.startsWith("audio.")) return file.type === "audio/mpeg" || /\.mp3$/i.test(file.name)
  if (slot.startsWith("rules")) return pdf(file)
  if (slot === "fontBody" || slot === "fontDisplay") return /\.(woff2?|ttf|otf)$/i.test(file.name)
  return image(file)
}

/** Key of a new track, from its file name (`Théâtre du soir.mp3` → `theatre-du-soir`). */
const trackKey = (name: string) =>
  name
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "track"

async function uploadAudio(game: GameModule, slot: string, buffer: Buffer, filename: string, title?: string) {
  const c = writer(game)
  const asset = await c.assets.upload("file", buffer, { filename, contentType: "audio/mpeg" })
  const file = { _type: "file", asset: { _type: "reference", _ref: asset._id } }
  if (slot === "audio.ambience") {
    await eachVersion(c, "audio", (target, tx) => {
      tx.patch(target, (p) => p.setIfMissing({ ambience: { _type: "audioLoop" } }))
      tx.patch(target, (p) => p.set({ "ambience.file": file }))
    })
    return
  }
  const [, kind, key] = slot.split(".") as [string, "effect" | "music", string]
  const list = kind === "effect" ? "effects" : "music"
  // The `_key` of an entry differs from one version of the document to another: each is read and patched on its own
  await eachVersion(c, "audio", async (target, tx) => {
    const current = await keysOf(c, target, list)
    const existing = key === "new" ? undefined : current.find((e) => e.key === key)
    if (existing) {
      tx.patch(target, (p) => p.set({ [`${list}[_key=="${existing._key}"].file`]: file }))
      return
    }
    if (kind === "effect" && !(key in codeSounds(game.binding).effects)) throw new ApiError("INVALID_REQUEST", 404)
    let newKey = key === "new" ? trackKey(filename) : key
    while (current.some((e) => e.key === newKey)) newKey = `${newKey}-2`
    const entry =
      kind === "effect"
        ? { _key: newKey, _type: "audioEffect", key: newKey, file }
        : { _key: newKey, _type: "audioTrack", key: newKey, title: title ?? newKey, file }
    tx.patch(target, (p) => p.setIfMissing({ [list]: [] }))
    tx.patch(target, (p) => p.append(list, [entry]))
  })
}

export async function uploadAsset(game: GameModule, slot: string, file: File) {
  if (!isUploadSlot(slot)) throw new ApiError("INVALID_REQUEST", 404)
  if (!accepts(slot, file)) throw new ApiError("INVALID_FILE")
  if (file.size > MAX_UPLOAD) throw new ApiError("FILE_TOO_LARGE")
  if (slot.startsWith("audio.")) {
    await uploadAudio(game, slot, Buffer.from(await file.arrayBuffer()), file.name, file.name.replace(/\.[^.]+$/, ""))
  } else {
    const conf = SLOTS[slot as UploadSlot]
    const converted = await conf.convert(file)
    const c = writer(game)
    const asset = await c.assets.upload(conf.asset, converted.buffer, { filename: converted.filename, contentType: converted.contentType })
    await patchDoc(game, conf.doc, { set: { [conf.field]: { _type: conf.asset, asset: { _type: "reference", _ref: asset._id } } } })
  }
  refresh(game.slug)
  return readAdminData(game)
}

export async function removeAsset(game: GameModule, slot: string) {
  if (!isUploadSlot(slot)) throw new ApiError("INVALID_REQUEST", 404)
  if (slot.startsWith("audio.")) {
    const c = writer(game)
    // Nothing to remove from a document that does not exist: no empty one is created
    await eachVersion(
      c,
      "audio",
      async (target, tx) => {
        if (slot === "audio.ambience") {
          tx.patch(target, (p) => p.unset(["ambience.file"]))
          return
        }
        const [, kind, key] = slot.split(".") as [string, "effect" | "music", string]
        const list = kind === "effect" ? "effects" : "music"
        const entry = (await keysOf(c, target, list)).find((e) => e.key === key)
        if (entry) tx.patch(target, (p) => p.unset([kind === "effect" ? `${list}[_key=="${entry._key}"].file` : `${list}[_key=="${entry._key}"]`]))
      },
      { create: false },
    )
  } else {
    const conf = SLOTS[slot as UploadSlot]
    await patchDoc(game, conf.doc, { unset: [conf.field] })
  }
  refresh(game.slug)
  return readAdminData(game)
}

/**
 * Sends to Sanity the sounds still served from `public/<slug>/sounds` (effects, music, ambience), keeping keys, titles,
 * volumes and loop ends. Can be run again: what is already in Sanity is skipped.
 */
export async function importCodeSounds(game: GameModule, origin: string) {
  const data = await readAdminData(game)
  const get = async (url: string) => {
    const res = await fetch(new URL(url, origin))
    if (!res.ok) throw new ApiError("SOUND_NOT_FOUND", 502)
    return Buffer.from(await res.arrayBuffer())
  }
  for (const e of data.audio.effects.filter((x) => !x.stored)) {
    await uploadAudio(game, `audio.effect.${e.key}`, await get(e.url!), `${e.key}.mp3`)
  }
  if (!data.audio.music.some((m) => m.stored)) {
    for (const m of data.audio.music) await uploadAudio(game, `audio.music.${m.key}`, await get(m.url), `${m.key}.mp3`, m.title)
    const c = writer(game)
    await eachVersion(
      c,
      "audio",
      async (target, tx) => {
        const keys = await keysOf(c, target, "music")
        const set: Record<string, unknown> = {}
        for (const m of data.audio.music) {
          const k = keys.find((x) => x.key === m.key)?._key
          if (k && m.loopEnd) set[`music[_key=="${k}"].loopEnd`] = m.loopEnd
        }
        if (data.audio.defaultMusic) set.defaultMusic = data.audio.defaultMusic
        if (!isEmpty(set)) tx.patch(target, (p) => p.set(set))
      },
      { create: false },
    )
  }
  if (data.audio.ambience && !data.audio.ambience.stored) {
    await uploadAudio(game, "audio.ambience", await get(data.audio.ambience.url), "ambience.mp3")
    const loopEnd = data.audio.ambience.loopEnd
    if (loopEnd) await eachVersion(writer(game), "audio", (target, tx) => void tx.patch(target, (p) => p.set({ "ambience.loopEnd": loopEnd })), { create: false })
  }
  refresh(game.slug)
  return readAdminData(game)
}
