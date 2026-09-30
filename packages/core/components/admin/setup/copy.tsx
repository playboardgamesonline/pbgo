"use client"

import { Add01Icon, Cancel01Icon, RotateLeft01Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMemo, useState } from "react"
import { Button } from "@pgo/ui/admin/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pgo/ui/admin/card"
import { Input } from "@pgo/ui/admin/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@pgo/ui/admin/input-group"
import { Textarea } from "@pgo/ui/admin/textarea"
import { cn } from "@pgo/ui/utils"
import type { CopyEntry, CopyGroup } from "../../../server/settings"
import { ReadOnlyAlert, SaveBar, SetupLayout, useSection, type AdminData } from "./index"

type Draft = { values: Record<string, string | null>; victoryPhrases: string[] | null }

const pick = (d: AdminData): Draft => ({
  values: Object.fromEntries(d.copy.entries.map((e) => [e.key, e.value])),
  victoryPhrases: d.copy.victoryPhrases.value,
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
  const setValue = (key: string, value: string | null) => setDraft((d) => ({ ...d, values: { ...d.values, [key]: value } }))

  const q = query.trim().toLowerCase()
  const visible = useMemo(
    () =>
      data.copy.entries.filter((e) =>
        q ? [e.label, e.fallback, draft.values[e.key] ?? "", e.key].some((t) => t.toLowerCase().includes(q)) : e.group === group,
      ),
    [data.copy.entries, q, group, draft.values],
  )
  const edited = (g: CopyGroup) => data.copy.entries.filter((e) => e.group === g && draft.values[e.key]).length + (g === "end" && draft.victoryPhrases ? 1 : 0)

  return (
    <SetupLayout>
      <ReadOnlyAlert writable={data.writable} />
      <div className="flex flex-wrap items-center gap-3">
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
            {q ? `${visible.length} text${visible.length > 1 ? "s" : ""}` : GROUPS.find((g) => g.id === group)!.description} Empty field = default text (shown in grey). Keep the
            variables in braces.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {visible.map((e) => (
              <CopyRow key={e.key} entry={e} value={draft.values[e.key] ?? null} onChange={(v) => setValue(e.key, v)} disabled={disabled} />
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
            {(draft.victoryPhrases ?? data.copy.victoryPhrases.fallback).map((p, i, list) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={p}
                  disabled={disabled}
                  className={cn(!draft.victoryPhrases && "text-muted-foreground")}
                  onChange={(e) => setDraft((d) => ({ ...d, victoryPhrases: list.map((x, j) => (j === i ? e.target.value : x)) }))}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove phrase"
                  disabled={disabled || list.length < 2}
                  onClick={() => setDraft((d) => ({ ...d, victoryPhrases: list.filter((_, j) => j !== i) }))}
                >
                  <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={disabled} onClick={() => setDraft((d) => ({ ...d, victoryPhrases: [...(d.victoryPhrases ?? data.copy.victoryPhrases.fallback), ""] }))}>
                <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
                Add
              </Button>
              {draft.victoryPhrases && (
                <Button variant="ghost" size="sm" disabled={disabled} onClick={() => setDraft((d) => ({ ...d, victoryPhrases: null }))}>
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

function CopyRow({ entry, value, onChange, disabled }: { entry: CopyEntry; value: string | null; onChange: (v: string | null) => void; disabled: boolean }) {
  const vars = variables(entry.fallback)
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
          placeholder={entry.fallback}
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
