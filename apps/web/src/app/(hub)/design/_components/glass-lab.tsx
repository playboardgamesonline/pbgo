"use client"

import { useState, type CSSProperties } from "react"
import { DEMO_AVATARS } from "@pbgo/accounts/demo-avatars"
import { Avatar, AvatarFallback, AvatarImage } from "@pbgo/ui/platform/avatar"
import { Button } from "@pbgo/ui/platform/button"
import { Logo } from "@pbgo/ui/platform/logo"
import { NavbarIsland } from "@pbgo/ui/platform/navbar"
import { SearchBar, SearchBarField, SearchBarInput, SearchBarSubmit } from "@pbgo/ui/platform/search-bar"
import { Slider } from "@pbgo/ui/platform/slider"

/** What the glass is now (`platform.css`): the grey of a card (half way between neutral 900 and 800, 0.237), and the three settings. */
const NOW = { grey: 0.237, opacity: 80, blur: 24, saturate: 100 }

const SETTINGS = [
  { key: "grey", label: "Grey", variable: "--card", min: 0.15, max: 0.42, step: 0.005, show: (value: number) => `oklch(${value.toFixed(3)} 0 0)` },
  { key: "opacity", label: "Opacity", variable: "--glass-opacity", min: 20, max: 100, step: 1, show: (value: number) => `${value}%` },
  { key: "blur", label: "Blur", variable: "--glass-blur", min: 0, max: 64, step: 1, show: (value: number) => `${value}px` },
  { key: "saturate", label: "Saturation", variable: "--glass-saturate", min: 100, max: 240, step: 5, show: (value: number) => `${value}%` },
] as const

const PEOPLE = [
  { name: "Marly", line: "Table K7P · 12 min", picture: DEMO_AVATARS.marly },
  { name: "Zoé", line: "In the lobby", picture: DEMO_AVATARS.zoe },
  { name: "Tom", line: "In the lobby", picture: DEMO_AVATARS.tom },
]

/**
 * The glass of the platform, moved live: the four values go on the stage as the variables of `.platform` (`--card`, `--glass-opacity`, `--glass-blur`, `--glass-saturate`), so the samples on it,
 * which are real components (an island of the navbar, the search bar, a panel), change as they do, over big shapes of the platform's colours and a title that give the glass something to let through.
 */
export function GlassLab() {
  const [value, setValue] = useState(NOW)
  const stage = Object.fromEntries(SETTINGS.map((setting) => [setting.variable, setting.show(value[setting.key])])) as CSSProperties
  const css = SETTINGS.map((setting) => `  ${setting.variable}: ${setting.show(value[setting.key])};`).join("\n")

  return (
    <div className="grid gap-px bg-border lg:grid-cols-[1fr_19rem]">
      <div style={stage} className="relative isolate flex min-h-[30rem] flex-col gap-6 overflow-hidden bg-background p-6">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <div className="absolute -top-10 -left-10 size-64 rotate-12 rounded-4xl bg-presence-playing" />
          <div className="absolute top-24 right-4 size-72 -rotate-6 rounded-4xl bg-presence-inactive" />
          <div className="absolute bottom-0 left-1/3 size-64 rotate-45 rounded-4xl bg-presence-online" />
          <div className="absolute right-0 -bottom-8 size-56 rounded-4xl bg-presence-dnd" />
          <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-7xl font-black tracking-tight text-foreground uppercase">Board games</p>
        </div>

        <NavbarIsland className="self-start">
          <Logo className="h-6 px-2" />
          <span className="px-3 text-sm text-muted-foreground">Games</span>
          <span className="px-3 text-sm text-muted-foreground">Tables</span>
          <span className="px-3 text-sm text-muted-foreground">Tournaments</span>
        </NavbarIsland>

        <div className="w-full max-w-md">
          <SearchBar method="dialog" aria-label="Search games, tables and tournaments">
            <SearchBarField>
              <SearchBarSubmit aria-label="Search" />
              <SearchBarInput aria-label="Search games, tables and tournaments" placeholder="Search games, tables & tournaments..." />
            </SearchBarField>
          </SearchBar>
        </div>

        <div className="glass flex w-72 flex-col gap-1 self-end rounded-4xl border p-4 shadow-overlay">
          {PEOPLE.map((person) => (
            <div key={person.name} className="flex items-center gap-3 rounded-2xl px-2.5 py-2">
              <Avatar>
                <AvatarImage src={person.picture} alt="" />
                <AvatarFallback>{person.name.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">{person.name}</p>
                <p className="truncate text-xs text-muted-foreground">{person.line}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-6 bg-card p-6">
        {SETTINGS.map((setting) => (
          <div key={setting.key} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <label id={`glass-${setting.key}`} className="text-sm text-foreground">
                {setting.label}
              </label>
              <code className="font-mono text-xs tracking-normal text-muted-foreground tabular-nums">{setting.show(value[setting.key])}</code>
            </div>
            <Slider
              aria-labelledby={`glass-${setting.key}`}
              min={setting.min}
              max={setting.max}
              step={setting.step}
              value={[value[setting.key]]}
              onValueChange={([next]) => setValue((all) => ({ ...all, [setting.key]: next ?? all[setting.key] }))}
              className="mx-1 w-auto"
            />
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => setValue(NOW)}>
          Back to what it is now
        </Button>
        <pre className="overflow-x-auto rounded-2xl bg-muted p-4 font-mono text-xs leading-relaxed tracking-normal text-foreground">{`.platform {\n${css}\n}`}</pre>
      </div>
    </div>
  )
}
