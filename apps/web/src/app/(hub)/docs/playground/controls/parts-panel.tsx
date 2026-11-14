"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons"
import { Label } from "@pbgo/ui/platform/label"
import { Switch } from "@pbgo/ui/platform/switch"
import { type ReactNode, useId } from "react"
import type { PlayPart } from "../../_specimens/scene/defaults"
import { docHref, filterParts, GROUPS, PARTS } from "../../_specimens/scene/play/catalog"
import type { Controls } from "./context"
import { PartControls } from "./part-controls"

/** A part of the table with its switch, a line of what it is, the page of the docs that explains it, and, when it is on, its own controls */
function Part({ part, controls, onShow, children }: { part: PlayPart; controls: Controls; onShow: (part: PlayPart, on: boolean) => void; children?: ReactNode }) {
  const id = useId()
  const info = PARTS[part]
  const on = controls.state.parts[part]
  return (
    <div className="flex flex-col gap-3 rounded-2xl border p-3">
      <div className="flex items-start gap-3">
        <Switch id={id} checked={on} onCheckedChange={(next) => onShow(part, next)} aria-describedby={`${id}-about`} className="mt-0.5" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={id}>{info.name}</Label>
            <a href={docHref(info.doc)} target="_blank" rel="noreferrer" aria-label={`${info.name} in the docs`} className="inline-flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
              Docs
              <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-3" strokeWidth={2} />
            </a>
          </div>
          <p id={`${id}-about`} className="text-xs leading-snug text-muted-foreground">
            {info.summary}
          </p>
        </div>
      </div>
      {on && children && <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-t pt-3">{children}</div>}
    </div>
  )
}

/** The Parts tab: every part of the table, in groups, or those that answer the search; a switch each, with its controls under it when it is on */
export function PartsPanel({ controls, query, onShow }: { controls: Controls; query: string; onShow: (part: PlayPart, on: boolean) => void }) {
  const found = filterParts(query)
  const searching = query.trim() !== ""
  if (found.length === 0) return <p className="text-sm text-muted-foreground">No part matches “{query}”. Try a word such as hand, dice, hex, score or flip.</p>
  const rows = (parts: PlayPart[]) =>
    parts.map((part) => (
      <Part key={part} part={part} controls={controls} onShow={onShow}>
        <PartControls part={part} controls={controls} />
      </Part>
    ))
  if (searching) return <div className="flex flex-col gap-2">{rows(found)}</div>
  return (
    <div className="flex flex-col gap-5">
      {GROUPS.map((group) => {
        const parts = found.filter((part) => PARTS[part].group === group)
        return (
          parts.length > 0 && (
            <section key={group} className="flex flex-col gap-2">
              <h2 className="px-1 text-xs tracking-wide text-muted-foreground uppercase">{group}</h2>
              {rows(parts)}
            </section>
          )
        )
      })}
    </div>
  )
}
