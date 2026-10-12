import "server-only"
import { cache } from "react"
import { sanityClient } from "../sanity/client"
import type { GameModule } from "./binding"
import { mediaUrl } from "./settings"
import { codeSounds, DEFAULT_VOLUMES, type EffectSound, type LoopSound, type SoundConfig, type Volumes } from "./sound-config"

/** Cache tag of a game's audio (revalidated when the admin saves). */
export const audioTag = (slug: string) => `${slug}:audio`

type FileRef = { url?: string | null } | null | undefined

export type AudioDoc = {
  volumes?: Partial<Volumes> | null
  defaultMusic?: string | null
  music?: { key?: string; title?: string; file?: FileRef; loopEnd?: number }[] | null
  ambience?: { file?: FileRef; loopEnd?: number } | null
  effects?: { key?: string; file?: FileRef; volume?: number }[] | null
} | null

export const AUDIO_QUERY = `*[_id == "audio"][0]{
  volumes, defaultMusic,
  music[]{ key, title, loopEnd, "file": file.asset->{url} },
  ambience{ loopEnd, "file": file.asset->{url} },
  effects[]{ key, volume, "file": file.asset->{url} }
}`

const fileUrl = (f: FileRef) => (f?.url ? mediaUrl(f.url) : null)
const volume = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null)
const seconds = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null)

/** Effective sounds: the ones declared by the game (`base`), files and volumes replaced by the Sanity "audio" document. */
export function toSoundConfig(doc: AudioDoc, base: SoundConfig): SoundConfig {
  const effects: Record<string, EffectSound> = Object.fromEntries(
    Object.entries(base.effects).map(([key, def]) => {
      const over = doc?.effects?.find((e) => e.key === key)
      return [key, { ...def, url: fileUrl(over?.file) ?? def.url ?? null, volume: volume(over?.volume) ?? def.volume }]
    }),
  )
  const sanityMusic = (doc?.music ?? []).filter((m) => m.key && fileUrl(m.file))
  const music: Record<string, LoopSound> | undefined = sanityMusic.length
    ? Object.fromEntries(sanityMusic.map((m) => [m.key!, { file: m.key!, url: fileUrl(m.file), title: m.title || m.key!, loopEnd: seconds(m.loopEnd) ?? 3600 }]))
    : base.music
  const ambienceUrl = fileUrl(doc?.ambience?.file)
  const ambience: LoopSound | undefined = ambienceUrl
    ? { file: "ambience", url: ambienceUrl, loopEnd: seconds(doc?.ambience?.loopEnd) ?? 3600 }
    : base.ambience && { ...base.ambience, loopEnd: seconds(doc?.ambience?.loopEnd) ?? base.ambience.loopEnd }
  const volumes = Object.fromEntries(
    Object.keys(DEFAULT_VOLUMES).map((k) => [k, volume(doc?.volumes?.[k as keyof Volumes]) ?? base.volumes?.[k as keyof Volumes] ?? DEFAULT_VOLUMES[k as keyof Volumes]]),
  ) as Volumes
  const defaultMusic = doc?.defaultMusic && music?.[doc.defaultMusic] ? doc.defaultMusic : base.defaultMusic && music?.[base.defaultMusic] ? base.defaultMusic : Object.keys(music ?? {})[0]
  return { effects, music, ambience, defaultMusic, volumes }
}

/** Sounds of a game: its own (`SOUNDS` of its binding), completed by its Sanity "audio" document. */
export const loadAudio = cache(async (game: GameModule): Promise<SoundConfig> => {
  const base = codeSounds(game.binding)
  const client = sanityClient(game)
  if (!client) return toSoundConfig(null, base)
  try {
    return toSoundConfig(await client.fetch<AudioDoc>(AUDIO_QUERY, {}, { next: { tags: [audioTag(game.slug)], revalidate: 60 } }), base)
  } catch {
    return toSoundConfig(null, base)
  }
})
