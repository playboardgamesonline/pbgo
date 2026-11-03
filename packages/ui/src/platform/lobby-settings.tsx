"use client"

import * as React from "react"
import { InfinityIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "../utils"
import { initials } from "../friends"
import { PACES, SPEEDS, type Pace } from "../tables"
import { Checkbox } from "./checkbox"
import { Label } from "./label"
import { ToggleGroup, ToggleGroupItem } from "./toggle-group"

// The settings of a game's lobby, at the bottom of its panel (`LobbyDetail`, and the space that opens one): how fast it is played, what it is played with and whether it has helpers. The speed of the game is a toggle of four, in this order: no timer (an icon alone, an
// infinity), slow, normal and fast (`SPEEDS`); then come the game's expansions, each a picture with its name and an outline when it is chosen; and, last, a box to tick for the helpers, the aids that a player may have while they play. A visitor who sets them (`editable`: the lobby
// is theirs) picks a speed, presses an expansion to choose it or to leave it and ticks the box; one who reads a table of the list sees only what it is played with and how fast. How many may play and who may join are not here: the number of players is above the seats
// (`LobbyPlayers`) and who may join is the button at the top right of the panel (`LobbyAccess`). Every table counts for the leaderboard and none can be looked on at, so neither is a setting. Nothing is kept yet: no lobby has a place to keep them (the tables of PLT-13), so what
// is set stays in the page; `onChange` is for the page that has somewhere to put it.

/** An expansion of a game that a table may be played with: what it is called and its pictures, its cover that fills its frame and the front of its box that is drawn whole in it when it has no cover (a stand-in with its initials when it has neither). */
type ExpansionOption = { id: string; name: string; coverUrl?: string | null; boxUrl?: string | null }

/** What the settings of a lobby say: the ids of the expansions it is played with, its pace and whether it has helpers. */
type LobbySettingsValue = { expansions: string[]; pace: Pace; helpers: boolean }

type LobbySettingsProps = Omit<React.ComponentProps<"div">, "onChange"> & {
  /** The expansions the game has. A game that has none has no group for them. */
  expansions?: readonly ExpansionOption[]
  /** The ones the table is played with, by id. */
  chosen?: readonly string[]
  /** How fast the table is played. */
  pace: Pace
  /** Whether the table has helpers, the aids a player may have while they play. Only a lobby that is opened or set says it: a table of the list does not. */
  helpers?: boolean
  /** Whether the visitor sets them (the lobby is theirs) or reads them (a table of the list). */
  editable?: boolean
  onChange?: (value: LobbySettingsValue) => void
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

/** The picture of an expansion, in a 3 × 2 frame on the `muted` fill: its cover fills it; with no cover, the front of its box is drawn whole in it, contained, since a box is not made for that shape; with neither, the initials of its name. */
function ExpansionPicture({ expansion }: { expansion: ExpansionOption }) {
  const { coverUrl, boxUrl } = expansion
  return (
    <span className="relative block aspect-3/2 overflow-hidden rounded-xl bg-muted">
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
      ) : boxUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={boxUrl} alt="" loading="lazy" decoding="async" className="size-full object-contain p-2" />
      ) : (
        <span aria-hidden="true" className="flex size-full items-center justify-center font-heading text-2xl text-muted-foreground">
          {initials(expansion.name)}
        </span>
      )}
    </span>
  )
}

/** What an expansion is in the settings: its picture and its name in a frame, outlined when the table is played with it. The name wraps and is never cut (an expansion's name often starts with its game's, and says nothing before its end); the frames of a row are as tall as the tallest. */
const TILE = "flex h-full w-full flex-col gap-2 rounded-2xl p-1.5 text-left outline-2 transition-colors duration-fast"

/**
 * The settings of a lobby: the speed, then the expansions of the game as pictures with their names (a visitor who sets the lobby presses one to choose it, and the outline says it is, `aria-pressed` for a screen reader; one who reads a table sees only the ones it is
 * played with), then, for a visitor who sets the lobby, the box of the helpers. Each group has its small title. The container decides the columns of the expansions (`@container`): two in a narrow panel, three from 28rem.
 */
function LobbySettings({ expansions = [], chosen = [], pace, helpers = true, editable = false, onChange, className, ...props }: LobbySettingsProps) {
  const helpersId = React.useId()
  const [set, setSet] = React.useState<LobbySettingsValue>({ expansions: [...chosen], pace, helpers })
  // What is read comes from the table that is given, so that the panel follows the row that is picked; what is set is the visitor's own
  const value = editable ? set : { expansions: [...chosen], pace, helpers }
  const change = (next: LobbySettingsValue) => {
    setSet(next)
    onChange?.(next)
  }
  const shown = editable ? expansions : expansions.filter((expansion) => value.expansions.includes(expansion.id))
  return (
    <div data-slot="lobby-settings" data-editable={editable ? "" : undefined} className={cn("@container flex flex-col gap-5", className)} {...props}>
      <Group title="Speed">
        {editable ? (
          <ToggleGroup type="single" value={value.pace} onValueChange={(next) => next && change({ ...set, pace: next as Pace })} aria-label="Speed of the game">
            {SPEEDS.map((speed) =>
              speed === "none" ? (
                // No timer is an infinity and nothing else: its name is for a screen reader and for the pointer
                <ToggleGroupItem key={speed} value={speed} aria-label="No timer" title="No timer" className="w-8 px-0">
                  <HugeiconsIcon icon={InfinityIcon} strokeWidth={2} className="size-4" aria-hidden="true" />
                </ToggleGroupItem>
              ) : (
                <ToggleGroupItem key={speed} value={speed}>
                  {PACES.find((pace) => pace.value === speed)?.label}
                </ToggleGroupItem>
              )
            )}
          </ToggleGroup>
        ) : (
          <p>{PACES.find((option) => option.value === value.pace)?.label}</p>
        )}
      </Group>
      {shown.length > 0 && (
        <Group title={editable ? "Expansions" : "Played with"}>
          <ul className="grid grid-cols-2 gap-3 @md:grid-cols-3">
            {shown.map((expansion) => {
              const on = value.expansions.includes(expansion.id)
              return (
                <li key={expansion.id}>
                  {editable ? (
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => change({ ...set, expansions: on ? set.expansions.filter((id) => id !== expansion.id) : [...set.expansions, expansion.id] })}
                      className={cn(TILE, "focus-visible:ring-3 focus-visible:ring-ring/30", on ? "outline-foreground" : "outline-transparent hover:outline-foreground/30")}
                    >
                      <ExpansionPicture expansion={expansion} />
                      <span className="px-1 text-sm">{expansion.name}</span>
                    </button>
                  ) : (
                    <div className={cn(TILE, "outline-foreground")}>
                      <ExpansionPicture expansion={expansion} />
                      <span className="px-1 text-sm">{expansion.name}</span>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </Group>
      )}
      {editable && (
        <div className="flex items-center gap-3">
          <Checkbox id={helpersId} checked={set.helpers} onCheckedChange={(next) => change({ ...set, helpers: next === true })} />
          <Label htmlFor={helpersId}>Helpers</Label>
        </div>
      )}
    </div>
  )
}

export { LobbySettings }
export type { ExpansionOption, LobbySettingsProps, LobbySettingsValue }
