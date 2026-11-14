"use client"

import { ease, EASING_NAMES } from "@pbgo/core/components/game/easing"
import { CARD_SETTINGS, notifySettings, PIECE_SETTINGS } from "@pbgo/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@pbgo/ui/platform/select"
import { useState } from "react"
import { Knob } from "../controls"

// The speed of the motion, on the page: how long a card flies and how high it arches, which curve its clock follows, and how long a piece glides. They are the settings every card and piece of the table reads on every frame (`CARD_SETTINGS`, `PIECE_SETTINGS`), so
// the next transition follows them. The visitor changes the package's own objects: `TuningGuard` puts them back when the page is left.

/** What a speed of 1 is: the settings as the package ships them */
const BASE = { duration: 0.64, glide: PIECE_SETTINGS.glide }

/** The curve of an easing as the points of a line in a box of 100 by 40, the start at the bottom left */
function curve(name: string): string {
  return Array.from({ length: 41 }, (_, i) => `${(i * 100) / 40},${(36 - ease(name, i / 40) * 32).toFixed(1)}`).join(" ")
}

export function MotionControls() {
  const [, redraw] = useState(0)
  const speed = BASE.duration / CARD_SETTINGS.flightDuration
  const write = (change: () => void) => {
    change()
    notifySettings()
    redraw((count) => count + 1)
  }
  return (
    <div className="flex flex-col gap-4">
      <Knob
        label="Speed"
        value={Math.round(speed * 20) / 20}
        min={0.25}
        max={3}
        step={0.05}
        format={(value) => `${value.toFixed(2)}×`}
        onChange={(value) =>
          write(() => {
            CARD_SETTINGS.flightDuration = BASE.duration / value
            PIECE_SETTINGS.glide = Math.min(1, BASE.glide / value)
          })
        }
      />
      <Knob label="Arc height" value={CARD_SETTINGS.flightHeight} min={0} max={3} step={0.01} format={(value) => `${value.toFixed(2)}×`} onChange={(value) => write(() => (CARD_SETTINGS.flightHeight = value))} />
      <div className="flex items-center gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="text-sm text-muted-foreground">Easing</span>
          <Select value={CARD_SETTINGS.easing} onValueChange={(value) => write(() => (CARD_SETTINGS.easing = value))}>
            <SelectTrigger aria-label="Easing of a flight" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EASING_NAMES.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <svg viewBox="0 0 100 40" className="mt-6 h-10 w-24 shrink-0 text-foreground" role="img" aria-label={`The curve of ${CARD_SETTINGS.easing}: time across, distance up`}>
          <line x1="0" y1="36" x2="100" y2="36" className="stroke-border" strokeWidth="1" />
          <polyline points={curve(CARD_SETTINGS.easing)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}
