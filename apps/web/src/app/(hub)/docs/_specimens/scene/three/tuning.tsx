"use client"

import {
  BAG_FIELDS,
  BAG_SETTINGS,
  CARD_FIELDS,
  CARD_SETTINGS,
  COUNTER_FIELDS,
  COUNTER_SETTINGS,
  CUP_FIELDS,
  CUP_SETTINGS,
  DIE_FIELDS,
  DIE_SETTINGS,
  DRAG_FIELDS,
  DRAG_SETTINGS,
  type Field,
  notifySettings,
  PIECE_FIELDS,
  PIECE_SETTINGS,
  SEAT_FIELDS,
  SEAT_SETTINGS,
  SKETCH_FIELDS,
  SKETCH_SETTINGS,
  SLIDER_FIELDS,
  SLIDER_SETTINGS,
  STEPPER_FIELDS,
  STEPPER_SETTINGS,
  TIMER_FIELDS,
  TIMER_SETTINGS,
  TRACK_FIELDS,
  TRACK_SETTINGS,
} from "@pbgo/table"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@pbgo/ui/platform/collapsible"
import { useEffect, useState } from "react"
import { Knob } from "../controls"

// The knobs of the debug panel, on the page. Every component of the table reads one settings object on every frame, and says in a list of fields which of its numbers can be tuned and between what ends: the controls are made from those lists, so a component that
// gains a setting gains its knob here. What the visitor changes is put back when the playground leaves the page, since the objects are the ones every table of the page reads.

type Settings = Record<string, unknown>
type Group = { name: string; settings: Settings; fields: Record<string, Field | undefined> }

const GROUPS: readonly Group[] = [
  { name: "Card", settings: CARD_SETTINGS, fields: CARD_FIELDS },
  { name: "Die", settings: DIE_SETTINGS, fields: DIE_FIELDS },
  { name: "Piece", settings: PIECE_SETTINGS, fields: PIECE_FIELDS },
  { name: "Counter", settings: COUNTER_SETTINGS, fields: COUNTER_FIELDS },
  { name: "Cup", settings: CUP_SETTINGS, fields: CUP_FIELDS },
  { name: "Bag", settings: BAG_SETTINGS, fields: BAG_FIELDS },
  { name: "Track", settings: TRACK_SETTINGS, fields: TRACK_FIELDS },
  { name: "Stepper", settings: STEPPER_SETTINGS, fields: STEPPER_FIELDS },
  { name: "Slider", settings: SLIDER_SETTINGS, fields: SLIDER_FIELDS },
  { name: "Sketch", settings: SKETCH_SETTINGS, fields: SKETCH_FIELDS },
  { name: "Timer", settings: TIMER_SETTINGS, fields: TIMER_FIELDS },
  { name: "Drag", settings: DRAG_SETTINGS, fields: DRAG_FIELDS },
  { name: "Seat", settings: SEAT_SETTINGS as unknown as Settings, fields: SEAT_FIELDS },
]

/** The numbers of a group that have a range, which a slider can move: a field that is a label alone or a list of choices has none */
function knobsOf({ settings, fields }: Group) {
  return Object.entries(fields).flatMap(([key, field]) => {
    const value = settings[key]
    return Array.isArray(field) && field.length === 4 && typeof value === "number" ? [{ key, label: field[0], min: field[1], max: field[2], step: field[3] }] : []
  })
}

export function Tuning() {
  // The sliders read the settings objects, which a slider changes: it asks for a new render to read what it wrote
  const [, redraw] = useState(0)
  useEffect(() => {
    const found = GROUPS.map(({ settings }) => ({ ...settings }))
    return () => {
      GROUPS.forEach(({ settings }, i) => Object.assign(settings, found[i]))
      notifySettings()
    }
  }, [])
  return (
    <div className="@container flex flex-col gap-2">
      {GROUPS.map((group) => (
        <Collapsible key={group.name} className="rounded-2xl border">
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm">
            <span>{group.name}</span>
            <span className="text-muted-foreground">{knobsOf(group).length} settings</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid gap-x-8 gap-y-5 px-4 pt-1 pb-5 @lg:grid-cols-2 @3xl:grid-cols-3">
              {knobsOf(group).map(({ key, label, min, max, step }) => (
                <Knob
                  key={key}
                  label={label}
                  value={group.settings[key] as number}
                  min={min}
                  max={max}
                  step={step}
                  onChange={(value) => {
                    group.settings[key] = value
                    notifySettings()
                    redraw((count) => count + 1)
                  }}
                />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  )
}
