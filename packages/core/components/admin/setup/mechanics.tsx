"use client"

import { LOCALE_NAMES, LOCALES } from "../../../lib/i18n"
import { LinkSquare02Icon, Pdf02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { GAME, type OptionDefinition, type OptionValue } from "@pbgo/binding"
import { Badge } from "@pbgo/ui/admin/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pbgo/ui/admin/card"
import { Field, FieldGroup, FieldLabel } from "@pbgo/ui/admin/field"
import { Input } from "@pbgo/ui/admin/input"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@pbgo/ui/admin/input-group"
import { Label } from "@pbgo/ui/admin/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@pbgo/ui/admin/select"
import { Switch } from "@pbgo/ui/admin/switch"
import { PLAYER_BOUNDS, RULES_SLOT, type SiteSettings, TURN_TIMEOUT_BOUNDS } from "../../../lib/settings"
import { FileTile, ReadOnlyAlert, SaveBar, SetupLayout, useSection, type AdminData } from "./index"

type Draft = Pick<SiteSettings, "minPlayers" | "maxPlayers" | "turnTimeout" | "options" | "rulesPdfLinks"> & { desktopOnly: boolean }

const pick = (d: AdminData): Draft => ({
  minPlayers: d.settings.minPlayers,
  maxPlayers: d.settings.maxPlayers,
  turnTimeout: d.settings.turnTimeout,
  options: d.settings.options,
  rulesPdfLinks: d.settings.rulesPdfLinks,
  desktopOnly: d.skin.desktopOnly,
})

export function MechanicsPage({ initial, studioUrl }: { initial: AdminData; studioUrl: string | null }) {
  const s = useSection("mechanics", initial, pick)
  const { data, draft, set, disabled } = s
  const options = Object.entries(GAME.options)
  const setOption = (key: string, value: OptionValue) => set("options", { ...draft.options, defaults: { ...draft.options.defaults, [key]: value } })
  const toggleHidden = (key: string, visible: boolean) =>
    set("options", { ...draft.options, hidden: visible ? draft.options.hidden.filter((k) => k !== key) : [...draft.options.hidden, key] })

  return (
    <SetupLayout>
      <ReadOnlyAlert writable={data.writable} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Players</CardTitle>
            <CardDescription>
              The engine allows {PLAYER_BOUNDS.min} to {PLAYER_BOUNDS.max} players.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="minPlayers">Minimum to start</FieldLabel>
                <Input id="minPlayers" type="number" min={PLAYER_BOUNDS.min} max={draft.maxPlayers} value={draft.minPlayers} onChange={(e) => set("minPlayers", Number(e.target.value))} disabled={disabled} />
              </Field>
              <Field>
                <FieldLabel htmlFor="maxPlayers">Maximum per game</FieldLabel>
                <Input id="maxPlayers" type="number" min={draft.minPlayers} max={PLAYER_BOUNDS.max} value={draft.maxPlayers} onChange={(e) => set("maxPlayers", Number(e.target.value))} disabled={disabled} />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Absent players</CardTitle>
            <CardDescription>After this delay without a move, the other players can play the turn for the absent one.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <input
                type="range"
                aria-label="Delay in seconds"
                min={TURN_TIMEOUT_BOUNDS.min}
                max={300}
                step={10}
                value={Math.min(300, draft.turnTimeout)}
                onChange={(e) => set("turnTimeout", Number(e.target.value))}
                disabled={disabled}
                className="flex-1 accent-primary"
              />
              <InputGroup className="w-28">
                <InputGroupInput
                  type="number"
                  aria-label="Seconds"
                  min={TURN_TIMEOUT_BOUNDS.min}
                  max={TURN_TIMEOUT_BOUNDS.max}
                  value={draft.turnTimeout}
                  onChange={(e) => set("turnTimeout", Number(e.target.value))}
                  disabled={disabled}
                  className="tabular-nums"
                />
                <InputGroupAddon align="inline-end">s</InputGroupAddon>
              </InputGroup>
            </div>
            <p className="text-xs text-muted-foreground">
              Between {TURN_TIMEOUT_BOUNDS.min} s and {TURN_TIMEOUT_BOUNDS.max / 60} min. Default {TURN_TIMEOUT_BOUNDS.default} s.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Game options</CardTitle>
          <CardDescription>Default value of each option for a new game, and whether the host can change it in the lobby. A hidden option keeps its default.</CardDescription>
        </CardHeader>
        <CardContent>
          {options.length === 0 ? (
            <p className="text-sm text-muted-foreground">This game has no options yet. They are declared by the engine (GAME.options): extensions, variants, number of rounds…</p>
          ) : (
            <ul className="divide-y">
              {options.map(([key, def]) => {
                const visible = !draft.options.hidden.includes(key)
                return (
                  <li key={key} className="grid items-center gap-4 py-3 sm:grid-cols-[minmax(0,1fr)_14rem_9rem]">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{def.label}</p>
                      {def.help && <p className="text-xs text-muted-foreground">{def.help}</p>}
                    </div>
                    <OptionControl def={def} value={draft.options.defaults[key] ?? def.defaultValue} onChange={(v) => setOption(key, v)} disabled={disabled} />
                    <div className="flex items-center justify-end gap-2">
                      <Switch id={`visible-${key}`} checked={visible} onCheckedChange={(v) => toggleHidden(key, v)} disabled={disabled} />
                      <Label htmlFor={`visible-${key}`} className="text-xs text-muted-foreground">
                        In lobby
                      </Label>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rules</CardTitle>
          <CardDescription>PDFs shown in the rules window, one per language (a player sees theirs first). Upload the file, or paste a link if it is over 4 MB.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            {(
              LOCALES.map((lang) => ({ lang, slot: RULES_SLOT[lang], label: LOCALE_NAMES[lang] }))
            ).map(({ lang, slot, label }) => {
              const file = data.settings.files[slot]
              return (
                <FieldGroup key={lang} className="gap-2">
                  <FileTile
                    label={`Rules PDF · ${label}`}
                    accept="application/pdf,.pdf"
                    aspect="h-24"
                    checker={false}
                    custom={!!file}
                    showDefault={false}
                    preview={
                      file ? (
                        <span className="flex items-center gap-2 px-4 text-sm">
                          <HugeiconsIcon icon={Pdf02Icon} strokeWidth={2} className="size-5 shrink-0" />
                          <span className="truncate">{file.name}</span>
                        </span>
                      ) : undefined
                    }
                    busy={s.uploading === slot}
                    disabled={disabled}
                    onFile={(f) => s.upload(slot, f)}
                    onRemove={() => s.remove(slot)}
                  />
                  {file ? (
                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
                      Open the PDF
                    </a>
                  ) : (
                    <InputGroup>
                      <InputGroupInput
                        type="url"
                        aria-label={`Rules link (${label})`}
                        placeholder="or paste a link https://…"
                        value={draft.rulesPdfLinks[lang] ?? ""}
                        onChange={(e) => set("rulesPdfLinks", { ...draft.rulesPdfLinks, [lang]: e.target.value || null })}
                        disabled={disabled}
                      />
                      {draft.rulesPdfLinks[lang] && (
                        <InputGroupAddon align="inline-end">
                          <InputGroupButton asChild size="icon-xs" aria-label="Open">
                            <a href={draft.rulesPdfLinks[lang]!} target="_blank" rel="noopener noreferrer">
                              <HugeiconsIcon icon={LinkSquare02Icon} strokeWidth={2} />
                            </a>
                          </InputGroupButton>
                        </InputGroupAddon>
                      )}
                    </InputGroup>
                  )}
                </FieldGroup>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Desktop only</CardTitle>
            <CardDescription>Below 900 px wide, players see a message asking them to use a computer.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Switch id="desktopOnly" checked={draft.desktopOnly} onCheckedChange={(v) => set("desktopOnly", v)} disabled={disabled} />
            <Label htmlFor="desktopOnly">{draft.desktopOnly ? "Computers only" : "All screens"}</Label>
            {draft.desktopOnly && <Badge variant="outline">Recommended for now</Badge>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Game content</CardTitle>
            <CardDescription>Cards, missions and the other game-specific data live in the Sanity Studio.</CardDescription>
          </CardHeader>
          <CardContent>
            {studioUrl ? (
              <a href={studioUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline">
                Open the Studio
                <HugeiconsIcon icon={LinkSquare02Icon} strokeWidth={2} className="size-3.5" />
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">Set NEXT_PUBLIC_SANITY_STUDIO_URL to link the Studio here.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <SaveBar dirty={s.dirty} saving={s.saving} disabled={disabled} onSave={s.save} onReset={s.reset} />
    </SetupLayout>
  )
}

function OptionControl({ def, value, onChange, disabled }: { def: OptionDefinition; value: OptionValue; onChange: (v: OptionValue) => void; disabled: boolean }) {
  if (def.type === "boolean") return <Switch checked={value === true} onCheckedChange={onChange} disabled={disabled} aria-label={def.label} />
  if (def.type === "choice")
    return (
      <Select value={String(value)} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full" aria-label={def.label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {def.choices.map((c) => (
            <SelectItem key={c.value} value={c.value}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  return (
    <Input type="number" aria-label={def.label} min={def.min} max={def.max} step={def.step ?? 1} value={Number(value)} onChange={(e) => onChange(Number(e.target.value))} disabled={disabled} />
  )
}
