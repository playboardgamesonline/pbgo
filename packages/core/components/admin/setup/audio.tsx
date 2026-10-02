"use client"

import { CloudUploadIcon, Delete02Icon, PauseIcon, PlayIcon, Upload04Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@pbgo/ui/admin/alert"
import { Badge } from "@pbgo/ui/admin/badge"
import { Button } from "@pbgo/ui/admin/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pbgo/ui/admin/card"
import { Input } from "@pbgo/ui/admin/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@pbgo/ui/admin/input-group"
import { Spinner } from "@pbgo/ui/admin/spinner"
import { cn } from "@pbgo/ui/utils"
import { adminRequest } from "../../../lib/admin-api"
import type { Volumes } from "../../../lib/sound-config"
import { ReadOnlyAlert, SaveBar, SetupLayout, useSection, type AdminData } from "./index"

type Draft = {
  volumes: Volumes
  defaultMusic: string | null
  music: { key: string; title: string; loopEnd: number | null }[]
  ambienceLoopEnd: number | null
  effects: Record<string, number>
}

const pick = (d: AdminData): Draft => ({
  volumes: d.audio.volumes,
  defaultMusic: d.audio.defaultMusic,
  music: d.audio.music.map((m) => ({ key: m.key, title: m.title, loopEnd: m.loopEnd })),
  ambienceLoopEnd: d.audio.ambience?.loopEnd ?? null,
  effects: Object.fromEntries(d.audio.effects.map((e) => [e.key, e.volume])),
})

const MP3 = "audio/mpeg,.mp3"
const VOLUME_LABELS: Record<keyof Volumes, string> = { master: "Master", music: "Music", effects: "Effects", ambience: "Ambience", alerts: "Alerts", reactions: "Reactions" }

/* Un seul son à la fois dans l'admin */
let current: HTMLAudioElement | null = null

function usePlayer() {
  const [playing, setPlaying] = useState<string | null>(null)
  useEffect(() => () => current?.pause(), [])
  function toggle(id: string, url: string, volume = 1) {
    current?.pause()
    if (playing === id) return setPlaying(null)
    const audio = new Audio(url)
    audio.volume = Math.min(1, Math.max(0, volume))
    audio.onended = () => setPlaying((p) => (p === id ? null : p))
    audio.play().catch(() => toast.error("This file cannot be played"))
    current = audio
    setPlaying(id)
  }
  return { playing, toggle }
}

function PlayButton({ id, url, volume, player }: { id: string; url: string | null; volume?: number; player: ReturnType<typeof usePlayer> }) {
  const on = player.playing === id
  return (
    <Button variant="outline" size="icon-sm" disabled={!url} aria-label={on ? "Stop" : "Play"} onClick={() => url && player.toggle(id, url, volume)}>
      <HugeiconsIcon icon={on ? PauseIcon : PlayIcon} strokeWidth={2} />
    </Button>
  )
}

function UploadButton({ label, busy, disabled, onFile, variant = "outline" }: { label: string; busy: boolean; disabled: boolean; onFile: (f: File) => void; variant?: "outline" | "ghost" }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <input ref={input} type="file" accept={MP3} hidden onChange={(e) => (e.target.files?.[0] && onFile(e.target.files[0]), (e.target.value = ""))} />
      <Button variant={variant} size="sm" disabled={disabled || busy} onClick={() => input.current?.click()}>
        {busy ? <Spinner data-icon="inline-start" /> : <HugeiconsIcon icon={Upload04Icon} strokeWidth={2} data-icon="inline-start" />}
        {label}
      </Button>
    </>
  )
}

function Slider({ value, onChange, disabled, label, className }: { value: number; onChange: (v: number) => void; disabled: boolean; label: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <input type="range" aria-label={label} min={0} max={1} step={0.01} value={value} onChange={(e) => onChange(Number(e.target.value))} disabled={disabled} className="flex-1 accent-primary" />
      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{Math.round(value * 100)}%</span>
    </div>
  )
}

export function AudioPage({ initial }: { initial: AdminData }) {
  const s = useSection("audio", initial, pick)
  const { data, draft, set, disabled } = s
  const player = usePlayer()
  const [importing, setImporting] = useState(false)
  const audio = data.audio
  const musicStored = audio.music.some((m) => m.stored)
  const setTrack = (key: string, patch: Partial<Draft["music"][number]>) => set("music", draft.music.map((m) => (m.key === key ? { ...m, ...patch } : m)))

  async function importSounds() {
    setImporting(true)
    try {
      s.setData(await adminRequest<AdminData>("/api/admin/settings", { method: "POST", body: JSON.stringify({ action: "importSounds" }) }))
      toast.success("Sounds imported into Sanity")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <SetupLayout>
      <ReadOnlyAlert writable={data.writable} />
      {audio.pendingImport > 0 && (
        <Alert>
          <HugeiconsIcon icon={CloudUploadIcon} strokeWidth={2} />
          <AlertTitle>
            {audio.pendingImport} sound{audio.pendingImport > 1 ? "s are" : " is"} still served from the code
          </AlertTitle>
          <AlertDescription>Import them into Sanity once so everything can be replaced from here. Keys, titles, volumes and loop points are kept.</AlertDescription>
          <AlertAction>
            <Button size="sm" onClick={importSounds} disabled={disabled || importing}>
              {importing && <Spinner data-icon="inline-start" />}
              Import into Sanity
            </Button>
          </AlertAction>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Default volumes</CardTitle>
          <CardDescription>Starting point for every player; each one can change them in the game.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {(Object.keys(VOLUME_LABELS) as (keyof Volumes)[]).map((k) => (
            <div key={k} className="flex flex-col gap-1.5">
              <p className="text-sm font-medium">{VOLUME_LABELS[k]}</p>
              <Slider label={VOLUME_LABELS[k]} value={draft.volumes[k]} onChange={(v) => set("volumes", { ...draft.volumes, [k]: v })} disabled={disabled} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Music</CardTitle>
          <CardDescription>
            Looped tracks, players pick one in the game. The loop end is the musical end of the loop (before the reverb tail); empty = the whole file. MP3 · 4 MB max.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="divide-y rounded-xl border">
            {audio.music.map((m) => {
              const d = draft.music.find((x) => x.key === m.key)
              return (
                <li key={m.key} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <PlayButton id={`music.${m.key}`} url={m.url} volume={draft.volumes.music * 4} player={player} />
                  <Input
                    aria-label="Title"
                    value={d?.title ?? m.title}
                    onChange={(e) => setTrack(m.key, { title: e.target.value })}
                    disabled={disabled || !m.stored}
                    className="h-8 w-48"
                  />
                  <InputGroup className="h-8 w-36">
                    <InputGroupInput
                      type="number"
                      aria-label="Loop end"
                      step={0.001}
                      min={0}
                      placeholder="end"
                      value={d?.loopEnd ?? ""}
                      onChange={(e) => setTrack(m.key, { loopEnd: e.target.value ? Number(e.target.value) : null })}
                      disabled={disabled || !m.stored}
                      className="tabular-nums"
                    />
                    <InputGroupAddon align="inline-end">s</InputGroupAddon>
                  </InputGroup>
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                    <input type="radio" name="defaultMusic" checked={draft.defaultMusic === m.key} onChange={() => set("defaultMusic", m.key)} disabled={disabled} className="accent-primary" />
                    Default
                  </label>
                  <span className="ml-auto flex items-center gap-1">
                    {!m.stored && <Badge variant="outline">Code</Badge>}
                    {m.stored && (
                      <>
                        <UploadButton label="Replace" variant="ghost" busy={s.uploading === `audio.music.${m.key}`} disabled={disabled} onFile={(f) => s.upload(`audio.music.${m.key}`, f)} />
                        <Button variant="ghost" size="icon-sm" aria-label="Remove track" disabled={disabled} onClick={() => s.remove(`audio.music.${m.key}`)}>
                          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                        </Button>
                      </>
                    )}
                  </span>
                </li>
              )
            })}
            {audio.music.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">No music yet.</li>}
          </ul>
          {(musicStored || audio.music.length === 0) && (
            <div>
              <UploadButton label="Add a track" busy={s.uploading === "audio.music.new"} disabled={disabled} onFile={(f) => s.upload("audio.music.new", f)} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ambience</CardTitle>
          <CardDescription>A quiet loop under the music (crowd, room tone…).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <PlayButton id="ambience" url={audio.ambience?.url ?? null} volume={draft.volumes.ambience * 3} player={player} />
          <InputGroup className="h-8 w-36">
            <InputGroupInput
              type="number"
              aria-label="Loop end"
              step={0.001}
              min={0}
              placeholder="end"
              value={draft.ambienceLoopEnd ?? ""}
              onChange={(e) => set("ambienceLoopEnd", e.target.value ? Number(e.target.value) : null)}
              disabled={disabled || !audio.ambience}
              className="tabular-nums"
            />
            <InputGroupAddon align="inline-end">s</InputGroupAddon>
          </InputGroup>
          {audio.ambience && !audio.ambience.stored && <Badge variant="outline">Code</Badge>}
          <span className="ml-auto flex items-center gap-1">
            <UploadButton label={audio.ambience ? "Replace" : "Upload"} variant="ghost" busy={s.uploading === "audio.ambience"} disabled={disabled} onFile={(f) => s.upload("audio.ambience", f)} />
            {audio.ambience?.stored && (
              <Button variant="ghost" size="icon-sm" aria-label="Remove ambience" disabled={disabled} onClick={() => s.remove("audio.ambience")}>
                <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
              </Button>
            )}
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Effects</CardTitle>
          <CardDescription>The sounds the game plays (the code decides when). Replace a file or adjust its volume.</CardDescription>
        </CardHeader>
        <CardContent>
          {audio.effects.length === 0 ? (
            <p className="text-sm text-muted-foreground">This game does not declare any sound effect (SOUNDS in the game code).</p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {audio.effects.map((e) => (
                <li key={e.key} className="grid items-center gap-3 px-3 py-2 sm:grid-cols-[2rem_8rem_minmax(0,1fr)_auto]">
                  <PlayButton id={`effect.${e.key}`} url={e.url} volume={draft.effects[e.key] ?? e.volume} player={player} />
                  <span className="truncate font-mono text-sm">{e.key}</span>
                  <Slider label={`${e.key} volume`} value={draft.effects[e.key] ?? e.volume} onChange={(v) => set("effects", { ...draft.effects, [e.key]: v })} disabled={disabled} />
                  <span className="flex items-center justify-end gap-1">
                    {!e.stored && <Badge variant="outline">Code</Badge>}
                    <UploadButton label="Replace" variant="ghost" busy={s.uploading === `audio.effect.${e.key}`} disabled={disabled} onFile={(f) => s.upload(`audio.effect.${e.key}`, f)} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <SaveBar dirty={s.dirty} saving={s.saving} disabled={disabled} onSave={s.save} onReset={s.reset} />
    </SetupLayout>
  )
}
