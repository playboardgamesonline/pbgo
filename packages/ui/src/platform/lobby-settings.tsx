"use client"

import * as React from "react"
import { cn } from "../utils"
import { initials } from "../friends"
import { PACES, type Pace } from "../tables"
import { ToggleGroup, ToggleGroupItem } from "./toggle-group"

// The settings of a game's lobby, at the bottom of its panel (`LobbyDetail`, and the space that opens one): what the table is played with and how fast. The game's expansions, each a picture with its name and an outline when it is chosen, the
// speed of the game (its pace: a clock on every turn, none, a day or more for each) and, for a lobby that is opened or set, who may find it. A visitor who sets them (`editable`: the lobby is theirs) presses an expansion to choose it or to leave it
// and picks a speed; one who reads a table of the list sees only what it is played with and how fast. Every table counts for the leaderboard and none can be looked on at, so neither is a setting. Nothing is kept yet: no lobby has a place to keep
// them (the tables of PLT-13), so what is set stays in the page; `onChange` is for the page that has somewhere to put it.

/** An expansion of a game that a table may be played with: what it is called and its pictures, the background that fills its frame and the logo that is drawn over it (a stand-in with its initials when it has neither). */
type ExpansionOption = { id: string; name: string; imageUrl?: string | null; logoUrl?: string | null }

/** What the settings of a lobby say: the ids of the expansions it is played with, its pace and, when it is a lobby that is opened or set, whether it is listed (`public`) or reached by its link (`private`). */
type LobbySettingsValue = { expansions: string[]; pace: Pace; visibility?: "public" | "private" }

type LobbySettingsProps = Omit<React.ComponentProps<"div">, "onChange"> & {
  /** The expansions the game has. A game that has none has no group for them. */
  expansions?: readonly ExpansionOption[]
  /** The ones the table is played with, by id. */
  chosen?: readonly string[]
  /** How fast the table is played. */
  pace: Pace
  /** Whether the table is listed. Only a lobby that is opened or set has it to say: every table of the list is public. */
  visibility?: "public" | "private"
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

/** The picture of an expansion, in a 3 × 2 frame: its background fills it and its logo is drawn over it, contained, as the picture of a game's card is; the initials of its name on the `muted` fill when it has neither. */
function ExpansionPicture({ expansion }: { expansion: ExpansionOption }) {
  const { imageUrl, logoUrl } = expansion
  return (
    <span className="relative block aspect-3/2 overflow-hidden rounded-xl bg-muted">
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
      )}
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" loading="lazy" decoding="async" className="relative size-full object-contain p-3" />
      )}
      {!imageUrl && !logoUrl && (
        <span aria-hidden="true" className="flex size-full items-center justify-center font-heading text-2xl text-muted-foreground">
          {initials(expansion.name)}
        </span>
      )}
    </span>
  )
}

/** What an expansion is in the settings: its picture and its name in a frame, outlined when the table is played with it. */
const TILE = "flex w-full flex-col gap-2 rounded-2xl p-1.5 text-left outline-2 transition-colors duration-fast"

/**
 * The settings of a lobby: the expansions of the game as pictures with their names (a visitor who sets the lobby presses one to choose it, and the outline says it is, `aria-pressed` for a screen reader; one who reads a table sees
 * only the ones it is played with), the speed, and who may find the table when the lobby is opened or set. Each is a group with its small title. The container decides the columns of the expansions (`@container`): two in a narrow
 * panel, three from 28rem.
 */
function LobbySettings({ expansions = [], chosen = [], pace, visibility, editable = false, onChange, className, ...props }: LobbySettingsProps) {
  const [set, setSet] = React.useState<LobbySettingsValue>({ expansions: [...chosen], pace, visibility })
  // What is read comes from the table that is given, so that the panel follows the row that is picked; what is set is the visitor's own
  const value = editable ? set : { expansions: [...chosen], pace, visibility }
  const change = (next: LobbySettingsValue) => {
    setSet(next)
    onChange?.(next)
  }
  const shown = editable ? expansions : expansions.filter((expansion) => value.expansions.includes(expansion.id))
  return (
    <div data-slot="lobby-settings" data-editable={editable ? "" : undefined} className={cn("@container flex flex-col gap-5", className)} {...props}>
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
                      <span className="truncate px-1 text-sm">{expansion.name}</span>
                    </button>
                  ) : (
                    <div className={cn(TILE, "outline-foreground")}>
                      <ExpansionPicture expansion={expansion} />
                      <span className="truncate px-1 text-sm">{expansion.name}</span>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </Group>
      )}
      <div className="flex flex-wrap gap-x-6 gap-y-5">
        <Group title="Speed">
          {editable ? (
            <ToggleGroup type="single" value={value.pace} onValueChange={(next) => next && change({ ...set, pace: next as Pace })} aria-label="Speed of the game">
              {PACES.map(({ value: option, label }) => (
                <ToggleGroupItem key={option} value={option}>
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : (
            <p>{PACES.find((option) => option.value === value.pace)?.label}</p>
          )}
        </Group>
        {editable && value.visibility !== undefined && (
          <Group title="Who can find it">
            <ToggleGroup type="single" value={value.visibility} onValueChange={(next) => next && change({ ...set, visibility: next as "public" | "private" })} aria-label="Who can find the table">
              <ToggleGroupItem value="public">Public</ToggleGroupItem>
              <ToggleGroupItem value="private">Private</ToggleGroupItem>
            </ToggleGroup>
          </Group>
        )}
      </div>
    </div>
  )
}

export { LobbySettings }
export type { ExpansionOption, LobbySettingsProps, LobbySettingsValue }
