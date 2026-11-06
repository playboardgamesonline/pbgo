"use client"

import { useId } from "react"
import { Label } from "@pbgo/ui/platform/label"
import { Slider } from "@pbgo/ui/platform/slider"
import { Switch } from "@pbgo/ui/platform/switch"
import { ToggleGroup, ToggleGroupItem } from "@pbgo/ui/platform/toggle-group"

// The controls under a scene, made of the platform's own components. Each is a real control: a slider is a slider, a switch is a switch, so that everything a pointer can do in the canvas has a keyboard way beside it.

/** A slider with its name and what it reads. `value` null means the scene has not said where to start yet: the slider waits, disabled. */
export function Knob({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = String,
}: {
  label: string
  value: number | null
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  format?: (value: number) => string
}) {
  return (
    <div className="flex min-w-44 flex-1 flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground tabular-nums">{value === null ? "…" : format(value)}</span>
      </div>
      <div className="px-1">
        <Slider
          min={min}
          max={max}
          step={step}
          value={[value ?? min]}
          disabled={value === null}
          onValueChange={([next = min]) => onChange(next)}
          thumbLabels={[label]}
          valueText={format}
        />
      </div>
    </div>
  )
}

/** A switch with its name beside it. */
export function Option({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  )
}

/** One pick among a few, as the platform's chips. A second press on the chip that is picked would unpick it, and a pick is never empty here: that press is ignored. */
export function Choice<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: Value
  options: readonly { value: Value; label: string; description?: string }[]
  onChange: (value: Value) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <ToggleGroup
        type="single"
        value={value}
        aria-label={label}
        onValueChange={(next) => {
          const pick = options.find((option) => option.value === next)
          if (pick) onChange(pick.value)
        }}
      >
        {options.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value} aria-label={option.description}>
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
