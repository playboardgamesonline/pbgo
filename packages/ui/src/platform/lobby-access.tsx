"use client"

import * as React from "react"
import { GlobeIcon, GlobeLockIcon, LockIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "../utils"
import { TIERS, type Tier } from "../ranks"
import { Button } from "./button"
import { Label } from "./label"
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "./popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"
import { ToggleGroup, ToggleGroupItem } from "./toggle-group"

// Who may join a lobby, as one button at the top right of its panel: an icon that says what it is now (a globe for a public lobby, a lock for a private one, a globe with a lock when a public one asks for something of its players), and a press opens a small panel
// that sets it. There the visitor picks Public, a table that is listed with the open tables, or Private, one that is reached by its link alone; and, for a public one, the criteria that restrict who may sit at it: a minimum rank and a language (each a select whose
// first choice asks for nothing). Only a lobby that is opened or set has it (`LobbyDetail` for the visitor's own, and the space that opens one): every table of the list is public and asks for nothing. Nothing is kept yet (no lobby has a place to keep it: the
// tables of PLT-13), so what is set stays in the page; `onChange` is for the page that has somewhere to put it.

type LobbyVisibilityValue = "public" | "private"

/** A language a lobby may ask its players to speak: its code and its name, as the picker shows it. */
type LanguageOption = { value: string; label: string }

/** What a lobby says of who may join: whether it is listed (`public`) or reached by its link (`private`) and, for a public one, the least rank it asks of a player and the language it asks them to speak (none: anyone). */
type LobbyAccessValue = { visibility: LobbyVisibilityValue; minRank: Tier | null; language: string | null }

type LobbyAccessProps = Omit<React.ComponentProps<typeof Button>, "variant" | "size" | "onChange" | "children" | "defaultValue"> & {
  /** What it is set to when it is drawn: the table's own, or `public` for a lobby that is about to be opened. */
  defaultVisibility?: LobbyVisibilityValue
  /** The least rank a player must have to sit at the table, a tier, or none. */
  defaultMinRank?: Tier | null
  /** The language the players are asked to speak, by its code, or none. */
  defaultLanguage?: string | null
  /** The languages a lobby may ask for. A page that gives none has no choice of language. */
  languages?: readonly LanguageOption[]
  onChange?: (value: LobbyAccessValue) => void
}

/** What a select cannot hold as an empty value: the choice that asks for nothing. */
const ANY = "any"

function LobbyAccess({ defaultVisibility = "public", defaultMinRank = null, defaultLanguage = null, languages = [], onChange, className, ...props }: LobbyAccessProps) {
  const titleId = React.useId()
  const rankId = React.useId()
  const languageId = React.useId()
  const [value, setValue] = React.useState<LobbyAccessValue>({ visibility: defaultVisibility, minRank: defaultMinRank, language: defaultLanguage })
  const change = (next: LobbyAccessValue) => {
    setValue(next)
    onChange?.(next)
  }
  const public_ = value.visibility === "public"
  // Only a public lobby asks for something: a private one is reached by its link
  const restricted = public_ && (value.minRank !== null || value.language !== null)
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          data-slot="lobby-access"
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={`Who can join: ${public_ ? "public" : "private"}${restricted ? ", with criteria" : ""}`}
          title="Who can join"
          className={className}
          {...props}
        >
          <HugeiconsIcon icon={public_ ? (restricted ? GlobeLockIcon : GlobeIcon) : LockIcon} strokeWidth={2} aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-labelledby={titleId} className="w-80">
        <PopoverHeader>
          <PopoverTitle id={titleId}>Who can join</PopoverTitle>
        </PopoverHeader>
        <ToggleGroup
          type="single"
          value={value.visibility}
          // Pressing the one that is on reports an empty value: a lobby is always one of the two, so it is ignored
          onValueChange={(next) => (next === "public" || next === "private") && change({ ...value, visibility: next })}
          aria-label="Who can find the table"
          className="w-full flex-nowrap"
        >
          <ToggleGroupItem value="public" className="flex-1">
            <HugeiconsIcon icon={GlobeIcon} strokeWidth={2} className="size-4" aria-hidden="true" />
            Public
          </ToggleGroupItem>
          <ToggleGroupItem value="private" className="flex-1">
            <HugeiconsIcon icon={LockIcon} strokeWidth={2} className="size-4" aria-hidden="true" />
            Private
          </ToggleGroupItem>
        </ToggleGroup>
        <p className="text-sm text-muted-foreground">{public_ ? "Listed with the open tables. Anybody who meets what it asks may sit at it." : "Reached by its link alone."}</p>
        {public_ && (
          <div className="flex flex-col gap-4 border-t pt-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={rankId}>Minimum rank</Label>
              <Select value={value.minRank ?? ANY} onValueChange={(next) => change({ ...value, minRank: next === ANY ? null : (next as Tier) })}>
                <SelectTrigger id={rankId} className="w-full">
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
            </div>
            {languages.length > 0 && (
              <div className="flex flex-col gap-2">
                <Label htmlFor={languageId}>Language</Label>
                <Select value={value.language ?? ANY} onValueChange={(next) => change({ ...value, language: next === ANY ? null : next })}>
                  <SelectTrigger id={languageId} className="w-full">
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
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

export { LobbyAccess }
export type { LanguageOption, LobbyAccessProps, LobbyAccessValue, LobbyVisibilityValue }
