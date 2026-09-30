"use client"

import { Add01Icon, Cancel01Icon, RotateLeft01Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMemo, useState } from "react"
import { Button } from "@pbgo/ui/admin/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pbgo/ui/admin/card"
import { Input } from "@pbgo/ui/admin/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@pbgo/ui/admin/input-group"
import { Textarea } from "@pbgo/ui/admin/textarea"
import { cn } from "@pbgo/ui/utils"
import { LOCALES, type Locale } from "../../../lib/i18n"
import type { CopyEntry, CopyGroup } from "../../../server/settings"
import { LangTabs } from "./lang-tabs"
import { ReadOnlyAlert, SaveBar, SetupLayout, useSection, type AdminData } from "./index"

type Draft = { values: Record<string, Record<Locale, string | null>>; victoryPhrases: Record<Locale, string[] | null> }

const pick = (d: AdminData): Draft => ({
  values: Object.fromEntries(d.copy.entries.map((e) => [e.key, e.values])),
  victoryPhrases: d.copy.victoryPhrases.values,
})

const GROUPS: { id: CopyGroup; title: string; description: string }[] = [
  { id: "home", title: "Home", description: "Welcome screen, nickname, create and join, feedback." },
  { id: "lobby", title: "Lobby", description: "Invitation, players and start." },
  { id: "game", title: "Game", description: "Turns, history and absent players." },
  { id: "end", title: "End", description: "Scoreboard, victory phrases and replay." },
  { id: "errors", title: "Errors", description: "Messages shown when an action is refused." },
]

const variables = (text: string) => [...new Set(text.match(/\{\w+\}/g) ?? [])]

export function CopyPage({ initial }: { initial: AdminData }) {
  const s = useSection("copy", initial, pick)
  const { data, draft, setDraft, disabled } = s
  const [query, setQuery] = useState("")
  const [group, setGroup] = useState<CopyGroup>("home")
  const [lang, setLang] = useState<Locale>("fr")
  const value = (key: string, l: Locale = lang) => draft.values[key]?.[l] ?? null
  const setValue = (key: string, v: string | null) => setDraft((d) => ({ ...d, values: { ...d.values, [key]: { ...d.values[key]!, [lang]: v } } }))
  const phrases = draft.victoryPhrases[lang]
  const fallbackPhrases = data.copy.victoryPhrases.fallbacks[lang]
  const setPhrases = (list: string[] | null) => setDraft((d) => ({ ...d, victoryPhrases: { ...d.victoryPhrases, [lang]: list } }))
  const countFor = (l: Locale) => data.copy.entries.filter((e) => value(e.key, l)).length + (draft.victoryPhrases[l] ? 1 : 0)

  const q = query.trim().toLowerCase()
  const visible = useMemo(
    () =>
      data.copy.entries.filter((e) =>
        q ? [e.label, e.fallbacks[lang], value(e.key) ?? "", e.key].some((t) => t.toLowerCase().includes(q)) : e.group === group,
      ),
    [data.copy.entries, q, group, draft.values, lang],
  )
  const edited = (g: CopyGroup) => data.copy.entries.filter((e) => e.group === g && value(e.key)).length + (g === "end" && phrases ? 1 : 0)

  return (
    <SetupLayout>
      <ReadOnlyAlert writable={data.writable} />
      <div className="flex flex-wrap items-center gap-3">
        <LangTabs value={lang} onChange={setLang} filled={Object.fromEntries(LOCALES.map((l) => [l, countFor(l)]))} />
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => (setGroup(g.id), setQuery(""))}
              className={cn(
                "flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:text-foreground",
                group === g.id && !q && "bg-background font-medium text-foreground shadow-xs",
              )}
            >
              {g.title}
              {edited(g.id) > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground tabular-nums">{edited(g.id)}</span>}
            </button>
          ))}
        </div>
        <InputGroup className="ml-auto w-64">
          <InputGroupAddon>
            <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
          </InputGroupAddon>
          <InputGroupInput placeholder="Search every text…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </InputGroup>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{q ? `Results for “${query.trim()}”` : GROUPS.find((g) => g.id === group)!.title}</CardTitle>
          <CardDescription>
            {q ? `${visible.length} text${visible.length > 1 ? "s" : ""}` : GROUPS.find((g) => g.id === group)!.description} Empty field = default text of this language (shown in grey). Keep the
            variables in braces.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {visible.map((e) => (
              <CopyRow key={e.key} entry={e} lang={lang} value={value(e.key)} onChange={(v) => setValue(e.key, v)} disabled={disabled} />
            ))}
            {visible.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No text matches.</li>}
          </ul>
        </CardContent>
      </Card>

      {!q && group === "end" && (
        <Card>
          <CardHeader>
            <CardTitle>Victory phrases</CardTitle>
            <CardDescription>One is picked at random on the scoreboard. {"{pseudo}"} and {"{points}"} are replaced.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {(phrases ?? fallbackPhrases).map((p, i, list) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={p}
                  disabled={disabled}
                  className={cn(!phrases && "text-muted-foreground")}
                  onChange={(e) => setPhrases(list.map((x, j) => (j === i ? e.target.value : x)))}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove phrase"
                  disabled={disabled || list.length < 2}
                  onClick={() => setPhrases(list.filter((_, j) => j !== i))}
                >
                  <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={disabled} onClick={() => setPhrases([...(phrases ?? fallbackPhrases), ""])}>
                <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
                Add
              </Button>
              {phrases && (
                <Button variant="ghost" size="sm" disabled={disabled} onClick={() => setPhrases(null)}>
                  <HugeiconsIcon icon={RotateLeft01Icon} strokeWidth={2} data-icon="inline-start" />
                  Back to default
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <SaveBar dirty={s.dirty} saving={s.saving} disabled={disabled} onSave={s.save} onReset={s.reset} />
    </SetupLayout>
  )
}

function CopyRow({ entry, lang, value, onChange, disabled }: { entry: CopyEntry; lang: Locale; value: string | null; onChange: (v: string | null) => void; disabled: boolean }) {
  const fallback = entry.fallbacks[lang]
  const vars = variables(entry.fallbacks.fr)
  const missing = value ? vars.filter((v) => !value.includes(v)) : []
  const Field = entry.multiline ? Textarea : Input
  return (
    <li className="grid gap-2 py-3 sm:grid-cols-[13rem_minmax(0,1fr)_2rem] sm:items-start">
      <div className="pt-1.5">
        <p className="text-sm font-medium">{entry.label}</p>
        {vars.length > 0 && <p className="font-mono text-[11px] text-muted-foreground">{vars.join(" ")}</p>}
      </div>
      <div className="flex flex-col gap-1">
        <Field
          aria-label={entry.label}
          value={value ?? ""}
          placeholder={fallback}
          rows={entry.multiline ? 3 : undefined}
          onChange={(e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => onChange(e.target.value || null)}
          disabled={disabled}
        />
        {missing.length > 0 && <p className="text-xs text-amber-600">Missing {missing.join(", ")}</p>}
      </div>
      {value ? (
        <Button variant="ghost" size="icon-sm" aria-label="Back to default" title="Back to default" disabled={disabled} onClick={() => onChange(null)}>
          <HugeiconsIcon icon={RotateLeft01Icon} strokeWidth={2} />
        </Button>
      ) : (
        <span />
      )}
    </li>
  )
}
