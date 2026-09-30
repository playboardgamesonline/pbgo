"use client"

import { type OptionDefinition, GAME, type OptionValue, type OptionValues, applyPreset, normalizeOptions, optionGroup, optionStatus, presetMatches } from "@pbgo/binding"
import { MinusIcon, PlusIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { api } from "../../lib/api"
import type { PublicGame } from "../../lib/game-types"
import { cn } from "@pbgo/ui/utils"
import { useSiteSettings } from "../settings-provider"
import { useText } from "../skin-provider"

export function GameOptions({ game, onUpdate }: { game: PublicGame; onUpdate: (p: PublicGame) => void }) {
  const editable = game.meId === game.hostId && game.status !== "playing"
  const [local, setLocal] = useState<{ version: number; values: OptionValues } | null>(null)
  const values = local && local.version >= game.version ? local.values : game.options
  const { options: optionSettings } = useSiteSettings()
  const t = useText()
  const ctx = { playerCount: game.players.length }
  const visible = Object.entries(GAME.options).filter(([key]) => !optionSettings.hidden.includes(key))
  const parameters = visible.filter(([, def]) => optionGroup(def) === "parameter")
  const extensions = visible.filter(([, def]) => optionGroup(def) === "extension")
  const presets = (GAME.presets ?? []).filter((p) => Object.keys(p.values).every((k) => !optionSettings.hidden.includes(k)))
  if (visible.length === 0) return null

  async function send(nextValues: OptionValues) {
    setLocal({ version: game.version + 1, values: nextValues })
    try {
      onUpdate(await api.options(game.code, nextValues))
    } catch (e) {
      setLocal(null)
      toast.error((e as Error).message)
    }
  }
  const change = (key: string, value: OptionValue) => send(normalizeOptions(GAME.options, { ...values, [key]: value }, ctx))
  const label = (k: string) => GAME.options[k]?.label ?? k

  function reason(key: string): string | null {
    const status = optionStatus(GAME.options, values, key, ctx)
    if (status.available) return null
    const names = (status.with ?? []).map(label).join(", ")
    if (status.reason === "players") return t("optionPlayers", { count: ctx.playerCount })
    return status.reason === "requires" ? t("optionNeeds", { names }) : t("optionConflicts", { names })
  }

  const title = "mb-4 flex items-baseline justify-between font-display text-sm font-semibold tracking-[0.14em] text-foreground/60 uppercase"
  return (
    <section className="mt-[4vh] w-full max-w-md space-y-6 rounded-2xl border border-foreground/10 bg-surface/70 p-5 backdrop-blur-sm">
      {presets.length > 0 && (
        <div>
          <h2 className={title}>{t("gamePresets")}</h2>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={!editable}
                title={preset.help}
                onClick={() => send(applyPreset(GAME.options, preset, ctx))}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors disabled:cursor-default",
                  presetMatches(preset, values) ? "border-transparent bg-accent-game font-semibold text-background" : "border-foreground/20",
                  editable && !presetMatches(preset, values) && "cursor-pointer hover:bg-foreground/10",
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {parameters.length > 0 && (
        <div>
          <h2 className={title}>
            {presets.length || extensions.length ? t("gameParameters") : t("gameOptions")}
            {!editable && <span className="text-xs tracking-normal normal-case">{t("chosenByHost")}</span>}
          </h2>
          <ul className="space-y-4">
            {parameters.map(([key, def]) => (
              <li key={key} className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold">{def.label}</p>
                  {def.help && <p className="text-xs text-foreground/50">{def.help}</p>}
                </div>
                <Control def={def} value={values[key] ?? def.defaultValue} editable={editable} onChange={(v) => change(key, v)} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {extensions.length > 0 && (
        <div>
          <h2 className={title}>
            {t("gameExtensions")}
            {!editable && parameters.length === 0 && <span className="text-xs tracking-normal normal-case">{t("chosenByHost")}</span>}
          </h2>
          <ul className="space-y-2">
            {extensions.map(([key, def]) => {
              const blocked = reason(key)
              const active = values[key] === true
              return (
                <li key={key} className={cn("flex items-center justify-between gap-4 rounded-xl border p-3 transition-colors", active ? "border-accent-game/60 bg-accent-game/10" : "border-foreground/10", blocked && !active && "opacity-50")}>
                  <div className="flex min-w-0 items-center gap-3">
                    {def.icon && <span className="text-2xl" aria-hidden>{def.icon}</span>}
                    <div className="min-w-0">
                      <p className="font-semibold">{def.label}</p>
                      {def.help && <p className="text-xs text-foreground/50">{def.help}</p>}
                      {blocked && <p className="text-xs text-foreground/60 italic">{blocked}</p>}
                    </div>
                  </div>
                  <Control def={def} value={active} editable={editable && (!blocked || active)} onChange={(v) => change(key, v)} />
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}

const BUTTON = "flex size-8 cursor-pointer items-center justify-center rounded-md border border-foreground/20 transition-colors hover:bg-foreground/10 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"

function Control({ def, value, editable, onChange }: { def: OptionDefinition; value: OptionValue; editable: boolean; onChange: (v: OptionValue) => void }) {
  if (def.type === "number") {
    const n = Number(value)
    const step = def.step ?? 1
    return (
      <div className="flex shrink-0 items-center gap-2">
        {editable && (
          <button type="button" aria-label="Moins" className={BUTTON} disabled={n <= def.min} onClick={() => onChange(Math.max(def.min, n - step))}>
            <MinusIcon className="size-4" />
          </button>
        )}
        <span className="w-8 text-center font-display text-xl font-bold tabular-nums">{n}</span>
        {editable && (
          <button type="button" aria-label="Plus" className={BUTTON} disabled={n >= def.max} onClick={() => onChange(Math.min(def.max, n + step))}>
            <PlusIcon className="size-4" />
          </button>
        )}
      </div>
    )
  }
  if (def.type === "choice")
    return (
      <div className="flex shrink-0 overflow-hidden rounded-lg border border-foreground/20">
        {def.choices.map((c) => (
          <button
            key={c.value}
            type="button"
            disabled={!editable}
            onClick={() => onChange(c.value)}
            className={cn(
              "px-3 py-1.5 text-sm transition-colors disabled:cursor-default",
              value === c.value ? "bg-accent-game font-semibold text-background" : editable ? "cursor-pointer hover:bg-foreground/10" : "text-foreground/50",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
    )
  const active = Boolean(value)
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      disabled={!editable}
      onClick={() => onChange(!active)}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:cursor-default", active ? "bg-accent-game" : "bg-foreground/20", editable && "cursor-pointer")}
    >
      <span className={cn("absolute top-1 size-5 rounded-full bg-foreground shadow transition-[left]", active ? "left-6" : "left-1")} />
    </button>
  )
}
