"use client"

import * as React from "react"
import { cn } from "../utils"
import { initials } from "../friends"
import { TIERS, type Tier } from "../ranks"
import { PACES, type Pace } from "../tables"
import { useLobbyAccess } from "./lobby-visibility"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"
import { ToggleGroup, ToggleGroupItem } from "./toggle-group"

// The settings of a game's lobby, at the bottom of its panel (`LobbyDetail`, and the space that opens one): how fast it is played, who may sit at it and what it is played with. The speed of the game (its pace: a clock on every turn, none, a day or more for each) comes first,
// then, while the lobby is public, the criteria that restrict who may sit at it, a minimum rank and a language, then the game's expansions, each a picture with its name and an outline when it is chosen. A visitor who sets them (`editable`: the lobby is theirs) presses an expansion
// to choose it or to leave it, picks a speed and sets the criteria; one who reads a table of the list sees only what it is played with and how fast. Who may find the table is not here but at the top of the panel (`LobbyVisibility`), and a private lobby, which is
// reached by its link, asks for no criteria: the two are told apart by the `LobbyAccess` around the panel. Every table counts for the leaderboard and none can be looked on at, so neither is a setting. Nothing is kept yet: no lobby has a place to keep
// them (the tables of PLT-13), so what is set stays in the page; `onChange` is for the page that has somewhere to put it.

/** An expansion of a game that a table may be played with: what it is called and its pictures, its cover that fills its frame and the front of its box that is drawn whole in it when it has no cover (a stand-in with its initials when it has neither). */
type ExpansionOption = { id: string; name: string; coverUrl?: string | null; boxUrl?: string | null }

/** A language a table may ask its players to speak: its code and its name, as the picker shows it. */
type LanguageOption = { value: string; label: string }

/** What the settings of a lobby say: the ids of the expansions it is played with, its pace and, when the visitor sets a public lobby, the least rank it asks of a player and the language it asks them to speak (none: anyone). */
type LobbySettingsValue = { expansions: string[]; pace: Pace; minRank: Tier | null; language: string | null }

type LobbySettingsProps = Omit<React.ComponentProps<"div">, "onChange"> & {
  /** The expansions the game has. A game that has none has no group for them. */
  expansions?: readonly ExpansionOption[]
  /** The ones the table is played with, by id. */
  chosen?: readonly string[]
  /** How fast the table is played. */
  pace: Pace
  /** The least rank a player must have to sit at the table: a tier, or none. */
  minRank?: Tier | null
  /** The language the players are asked to speak, by its code, or none. */
  language?: string | null
  /** The languages a lobby may ask for. A page that gives none has no group for the language. */
  languages?: readonly LanguageOption[]
  /** Whether the visitor sets them (the lobby is theirs) or reads them (a table of the list). */
  editable?: boolean
  onChange?: (value: LobbySettingsValue) => void
}

/** What a criterion is set to when it asks for nothing: a select cannot hold an empty value. */
const ANY = "any"

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
 * The settings of a lobby: the speed, the criteria of a public lobby that the visitor sets, then the expansions of the game as pictures with their names (a visitor who sets the lobby presses one to choose it, and the outline says
 * it is, `aria-pressed` for a screen reader; one who reads a table sees only the ones it is played with). Each is a group with its small title. The container decides the columns of the expansions (`@container`): two in a narrow
 * panel, three from 28rem.
 */
function LobbySettings({ expansions = [], chosen = [], pace, minRank = null, language = null, languages = [], editable = false, onChange, className, ...props }: LobbySettingsProps) {
  const [set, setSet] = React.useState<LobbySettingsValue>({ expansions: [...chosen], pace, minRank, language })
  // Only a lobby that is public asks for criteria: a private one is reached by its link
  const access = useLobbyAccess()
  const restricts = editable && access?.visibility === "public"
  // What is read comes from the table that is given, so that the panel follows the row that is picked; what is set is the visitor's own
  const value = editable ? set : { expansions: [...chosen], pace, minRank, language }
  const change = (next: LobbySettingsValue) => {
    setSet(next)
    onChange?.(next)
  }
  const shown = editable ? expansions : expansions.filter((expansion) => value.expansions.includes(expansion.id))
  return (
    <div data-slot="lobby-settings" data-editable={editable ? "" : undefined} className={cn("@container flex flex-col gap-5", className)} {...props}>
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
        {restricts && (
          <Group title="Minimum rank">
            <Select value={set.minRank ?? ANY} onValueChange={(next) => change({ ...set, minRank: next === ANY ? null : (next as Tier) })}>
              <SelectTrigger aria-label="Minimum rank of the players" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any rank</SelectItem>
                {/* The lowest tier is every player's: asking for it asks for nothing */}
                {TIERS.slice(1).map((tier) => (
                  <SelectItem key={tier} value={tier}>
                    {tier} and above
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Group>
        )}
        {restricts && languages.length > 0 && (
          <Group title="Language">
            <Select value={set.language ?? ANY} onValueChange={(next) => change({ ...set, language: next === ANY ? null : next })}>
              <SelectTrigger aria-label="Language of the players" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any language</SelectItem>
                {languages.map(({ value: code, label }) => (
                  <SelectItem key={code} value={code}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Group>
        )}
      </div>
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
    </div>
  )
}

export { LobbySettings }
export type { ExpansionOption, LanguageOption, LobbySettingsProps, LobbySettingsValue }
