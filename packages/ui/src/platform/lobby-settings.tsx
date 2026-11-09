"use client"

import * as React from "react"
import { ArrowDown01Icon, InfinityIcon, LockIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { cn } from "../utils"
import { initials } from "../friends"
import { PACES, SPEEDS, type Pace } from "../tables"
import { Badge } from "./badge"
import { Button } from "./button"
import { Checkbox } from "./checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible"
import { Label } from "./label"
import { Switch } from "./switch"
import { ToggleGroup, ToggleGroupItem } from "./toggle-group"

// The settings of a game's lobby, under the seats in its panel (`LobbyDetail`, and the space that opens one): how fast it is played, what it is played with and whether it has helpers. The speed of the game is a segmented toggle of four, in this order and in one container as wide as the settings: no timer (an icon alone, an
// infinity, narrower), then slow, normal and fast (`SPEEDS`) of the same width, the thumb behind the one that is picked gliding to the next when another is; then come the game's expansions, each a card with a small checkbox, its picture, in the shape of its source, and at the right of the picture its name, its description and what it changes about the game, and, for an expansion that has settings of its own, a button that unrolls them; and, last, the helpers, the aids that a player may have while they play: a title like the others and a row for each that the game offers, with what it is called, what it does and a switch. A visitor who sets them (`editable`: the lobby
// is theirs) picks a speed, ticks an expansion to choose it or to leave it and switches the helpers; one who reads a table of the list has the same slider, which cannot be pressed, and sees only what it is played with besides (a pace that is not on the slider, a table played a day a turn, is said in words). How many may play and who may join are not here: the number of players is above the seats
// (`LobbyPlayers`) and who may join is the button at the top right of the panel (`LobbyAccess`). Every table counts for the leaderboard and none can be looked on at, so neither is a setting. Nothing is kept yet: no lobby has a place to keep them (the tables of PLT-13), so what
// is set stays in the page; `onChange` is for the page that has somewhere to put it.

/** A setting that a switch has on or off, as a row: what it is called ("Show the score calculation"), in one line of text. Its `id` is the game's own, which the table will carry. */
type SettingOption = { id: string; label: string }

/** A helper of a game, an aid that a player may have while they play: a setting of the lobby with a row of its own. */
type HelperOption = SettingOption

/** A figure that an expansion changes, with the icon that the head of the game's page gives that figure ("2–6 players", "Ages 10+"). */
type ExpansionFact = { icon: IconSvgElement; text: string }

/** A category that an expansion brings, as a tag with the icon of that category. */
type ExpansionTag = { label: string; icon: IconSvgElement }

/**
 * An expansion of a game that a table may be played with: what it is called, its pictures, its cover and the front of its box (the one that is drawn is the cover, else the box; a stand-in with its initials when it has neither), each with its shape, its width over its height, when the page knows it,
 * so that its card has the shape of its source before the picture has arrived; its description, in the language it was found in; the figures that it changes, only those that differ from its game's, each with its icon (`facts`: "2–6 players"); the categories
 * that it brings, each a tag with its icon (`tags`); and, for an expansion that has some, its own settings (`settings`), which its card shows under a button when it is chosen.
 */
type ExpansionOption = {
  id: string
  name: string
  description?: { text: string; language: string } | null
  facts?: readonly ExpansionFact[]
  tags?: readonly ExpansionTag[]
  settings?: readonly SettingOption[]
  coverUrl?: string | null
  coverRatio?: number | null
  boxUrl?: string | null
  boxRatio?: number | null
  /** The visitor cannot choose it, and why: the card says the reason in a few words (`reason`) in place of letting its box be ticked, and a press on it is handed to the page (`onLockedPick`, with `kind`, the page's own word for the reason). Leaving it off, once it is chosen, is never locked. */
  locked?: ExpansionLock
}

/** Why an expansion cannot be chosen: what the card says (`reason`) and the page's own word for it (`kind`), which `onLockedPick` hands back. */
type ExpansionLock = { reason: string; kind?: string }

/** What the settings of a lobby say: the ids of the expansions it is played with, its pace, the ids of the helpers it has on, and for each expansion the ids of its settings that are on. */
type LobbySettingsValue = { expansions: string[]; pace: Pace; helpers: string[]; expansionSettings: Record<string, string[]> }

type LobbySettingsProps = Omit<React.ComponentProps<"div">, "onChange"> & {
  /** The expansions the game has. A game that has none has no group for them. */
  expansions?: readonly ExpansionOption[]
  /** The ones the table is played with, by id. */
  chosen?: readonly string[]
  /** How fast the table is played. */
  pace: Pace
  /** The helpers the game offers, the aids a player may have while they play: a row each, for a lobby that is opened or set (a table of the list says none). A game that offers none has no group for them. */
  helpers?: readonly HelperOption[]
  /** The helpers the lobby has on, by id: every one the game offers when it is not said. */
  chosenHelpers?: readonly string[]
  /** Whether the visitor sets them (the lobby is theirs) or reads them (a table of the list). */
  editable?: boolean
  /** What the page puts between the speed and the expansions, as a block of the settings: the signed-in home's Create a table has the number of players there (`LobbyPlayers`), since it sets them before the lobby has seats. */
  afterSpeed?: React.ReactNode
  onChange?: (value: LobbySettingsValue) => void
  /** A press on the box of an expansion the visitor cannot choose (`ExpansionOption.locked`): the expansion is not chosen, and the page decides what to do (tell why, ask for what is missing). */
  onLockedPick?: (id: string, locked: ExpansionLock) => void
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

/**
 * The picture of an expansion, in the shape of its source: its cover, else the front of its box, drawn whole at the left of its card, and no taller than a box of 6rem (8rem when the settings are 28rem wide, `@container`) that its shape fits in: a portrait is 6rem
 * tall and narrower, a banner is 6rem wide and lower, nothing is cut. Its shape (`coverRatio`, `boxRatio`) is the frame's before the picture is in, so that the card does not jump when it comes; a picture whose shape the page does not know is 6rem wide and has its own height once it is
 * in. With neither a cover nor a box there is no source to follow: the initials of its name, in a 3 × 2 frame on the `muted` fill. `className` is for what the card does to it (it dims and loses its colour when the expansion is not chosen).
 */
function ExpansionPicture({ expansion, className }: { expansion: ExpansionOption; className?: string }) {
  const { coverUrl, coverRatio, boxUrl, boxRatio } = expansion
  const source = coverUrl ? { url: coverUrl, ratio: coverRatio } : boxUrl ? { url: boxUrl, ratio: boxRatio } : null
  if (!source) {
    return (
      <span aria-hidden="true" className={cn("flex aspect-3/2 w-24 shrink-0 items-center justify-center rounded-lg bg-muted font-heading text-2xl text-muted-foreground @md:w-32", className)}>
        {initials(expansion.name)}
      </span>
    )
  }
  const { ratio } = source
  return (
    <span
      className={cn(
        "block shrink-0 overflow-hidden rounded-lg bg-muted",
        ratio ? "w-[min(6rem,calc(6rem*var(--ratio)))] @md:w-[min(8rem,calc(8rem*var(--ratio)))]" : "w-24 @md:w-32",
        className
      )}
      style={ratio ? ({ "--ratio": ratio, aspectRatio: ratio } as React.CSSProperties) : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={source.url} alt="" loading="lazy" decoding="async" className={ratio ? "size-full object-cover" : "block h-auto w-full"} />
    </span>
  )
}

/** The chips of the speed are taller than a chip's usual 2rem: the slider is the one control of the panel that is pressed to set something, and it is read first. */
const CHIP = "h-10"

/** A slider that is read (a table of the list, `disabled`) keeps the speed that it says as strong as when it is set, and dims the others: a value to read is not a control that is off. */
const READ = "data-[state=on]:disabled:opacity-100"

/**
 * The card of an expansion: a small checkbox at its left, then its picture and, at the right of the picture, its name, under it its description (two lines at most, the whole text being its tooltip), then what it changes about the game, the figures that differ from its game's, each
 * with its icon as the head of the page has them (`facts`), and the categories that it brings, as tags with their icons (`tags`). The box says whether the table is played with it, and so does the picture, which is in its colours when the expansion is chosen and dimmed and grey when it is not, and the card, which has a fill a step lighter than the panel's when it is chosen and a half of it under the pointer. The card's corners are `rounded-xl`, one step over the picture's (`rounded-lg`): a tile, not a pill; it has 12px of room round its content (`p-3`) and reaches 12px out of the column (`-mx-3`) so that what is in it stands where the titles of the groups do. A visitor who sets the lobby ticks the box, or presses anywhere on the card (it is the box's label), to choose the expansion or to leave it (`onChosenChange`); an expansion that has settings of its own (`settings`) has a button at the right
 * that unrolls them under the card, as rows with a switch, once it is chosen. One who reads a table sees only the cards of the ones it is played with, with no box and no button. The box is named by the title and described by the rest. The name wraps and is never cut (an expansion's name
 * often starts with its game's, and says nothing before its end). An expansion that the visitor cannot choose (`locked`, for its age) keeps its box unticked and says why under what it changes, with a lock; a press on it is handed to the page (`onLockedPick`),
 * and one that is chosen already can always be left.
 */
const CARD = "-mx-3 flex flex-col rounded-xl p-3 transition-colors duration-fast"

/**
 * The room that a line leaves above its capitals and under its baseline, taken off (`1lh` is the line, `1cap` the height of a capital: half of what is left of the line goes at each end), so that what is round a text is its margins and the gaps alone and the distances in a card are the ones that are seen:
 * the picture is 12px from the card's top, the capitals of the name start 6px under the top of the picture (`pt-1.5` of the text column), and the bottom of the card is 12px from the lowest of the picture and the last row.
 */
const TRIM = "my-[calc((1cap_-_1lh)/2)]"

function ExpansionCard({
  expansion,
  chosen,
  onChosenChange,
  onLockedPick,
  settingsOn = [],
  onSettingChange,
}: {
  expansion: ExpansionOption
  chosen: boolean
  onChosenChange?: (chosen: boolean) => void
  /** A press on the box of an expansion that is locked and not chosen. */
  onLockedPick?: () => void
  settingsOn?: readonly string[]
  onSettingChange?: (setting: string, on: boolean) => void
}) {
  const id = React.useId()
  const [open, setOpen] = React.useState(false)
  const { name, description, facts = [], tags = [], settings = [], locked } = expansion
  const editable = onChosenChange !== undefined
  // A lock is about choosing: an expansion that is chosen already can always be left
  const shut = editable && locked !== undefined && !chosen
  const described = [description ? `${id}-description` : null, facts.length > 0 ? `${id}-facts` : null, tags.length > 0 ? `${id}-tags` : null, shut ? `${id}-locked` : null].filter((part) => part !== null).join(" ")
  const body = (
    <>
      <ExpansionPicture expansion={expansion} className={cn("transition-[opacity,filter] duration-fast", !chosen && "opacity-50 grayscale")} />
      <span className="flex min-w-0 flex-1 flex-col gap-3 pt-1.5">
        <span id={`${id}-name`} className={cn("text-base leading-snug", TRIM)}>
          {name}
        </span>
        {description && (
          <span id={`${id}-description`} lang={description.language} title={description.text} className={cn("line-clamp-2 text-sm text-muted-foreground", TRIM)}>
            {description.text}
          </span>
        )}
        {(facts.length > 0 || tags.length > 0) && (
          // What the expansion changes stands apart from what it says: 16px under the description (12px of the column's gap and 4px of its own), where the name has 12px above it; the figures and the tags are 8px apart
          <span className="mt-1 flex flex-col gap-2">
            {facts.length > 0 && (
              <span id={`${id}-facts`} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {facts.map(({ icon, text }) => (
                  <span key={text} className="inline-flex items-center gap-1.5">
                    <HugeiconsIcon icon={icon} strokeWidth={2} className="size-4" aria-hidden="true" />
                    <span className={TRIM}>{text}</span>
                  </span>
                ))}
              </span>
            )}
            {tags.length > 0 && (
              <span id={`${id}-tags`} className="flex flex-wrap gap-1.5">
                {tags.map(({ label, icon }) => (
                  <Badge key={label} variant="secondary" className="h-6 gap-1.5 bg-foreground/10 px-2 text-xs [&>svg]:size-3.5!">
                    <HugeiconsIcon icon={icon} strokeWidth={2} aria-hidden="true" />
                    {label}
                  </Badge>
                ))}
              </span>
            )}
          </span>
        )}
        {shut && (
          // Why the box cannot be ticked, in the muted text of the figures: a press on the card hands it to the page
          <span id={`${id}-locked`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <HugeiconsIcon icon={LockIcon} strokeWidth={2} className="size-4" aria-hidden="true" />
            <span className={TRIM}>{locked.reason}</span>
          </span>
        )}
      </span>
    </>
  )
  const hasSettings = editable && settings.length > 0
  return (
    <Collapsible
      open={hasSettings && chosen && open}
      onOpenChange={setOpen}
      data-slot="lobby-expansion"
      data-chosen={chosen ? "" : undefined}
      className={cn(CARD, editable && (chosen ? "bg-muted" : "hover:bg-muted/50"))}
    >
      <div className="flex items-start gap-3">
        {editable ? (
          <>
            <Checkbox
              id={`${id}-choice`}
              checked={chosen}
              onCheckedChange={(next) => (shut && next === true ? onLockedPick?.() : onChosenChange(next === true))}
              aria-labelledby={`${id}-name`}
              aria-describedby={described || undefined}
              className="mt-1 shrink-0"
            />
            <label htmlFor={`${id}-choice`} className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
              {body}
            </label>
          </>
        ) : (
          <div className="flex min-w-0 flex-1 items-start gap-3">{body}</div>
        )}
        {hasSettings && (
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" size="icon-xs" disabled={!chosen} aria-label={`Settings of ${name}`} className="shrink-0 data-[state=open]:[&_svg]:rotate-180">
              <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} className="size-4 transition-transform duration-fast" aria-hidden="true" />
            </Button>
          </CollapsibleTrigger>
        )}
      </div>
      {hasSettings && (
        <CollapsibleContent>
          <ul className="mt-3 flex flex-col gap-4 border-t pt-4 pb-1">
            {settings.map((setting) => (
              <SwitchRow key={setting.id} option={setting} on={settingsOn.includes(setting.id)} onChange={(on) => onSettingChange?.(setting.id, on)} />
            ))}
          </ul>
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}

/** A setting as a row, small: its name, in one line of text, and at the right the switch that has it on or off. A helper of the game is one, and so is a setting of an expansion. */
function SwitchRow({ option, on, onChange }: { option: SettingOption; on: boolean; onChange: (on: boolean) => void }) {
  const id = React.useId()
  return (
    <li data-slot="lobby-switch" className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="min-w-0 text-sm leading-snug">
        {option.label}
      </Label>
      <Switch id={id} size="sm" checked={on} onCheckedChange={onChange} />
    </li>
  )
}

/**
 * The settings of a lobby: the speed, then the expansions of the game as cards (a visitor who sets the lobby ticks one to choose it; one who reads a table sees only the ones it is played with), then, for a visitor who sets the lobby, the helpers that the game
 * offers, a small row and a switch each. Each group has its small title. The container decides the width of the picture of an expansion and whether the names of the speeds fit (`@container`).
 */
function LobbySettings({ expansions = [], chosen = [], pace, helpers = [], chosenHelpers, editable = false, afterSpeed, onChange, onLockedPick, className, ...props }: LobbySettingsProps) {
  const [set, setSet] = React.useState<LobbySettingsValue>({ expansions: [...chosen], pace, helpers: chosenHelpers ? [...chosenHelpers] : helpers.map((helper) => helper.id), expansionSettings: {} })
  // What is read comes from the table that is given, so that the panel follows the row that is picked; what is set is the visitor's own
  const value = editable ? set : { expansions: [...chosen], pace, helpers: [], expansionSettings: {} }
  const change = (next: LobbySettingsValue) => {
    setSet(next)
    onChange?.(next)
  }
  const shown = editable ? expansions : expansions.filter((expansion) => value.expansions.includes(expansion.id))
  return (
    <div data-slot="lobby-settings" data-editable={editable ? "" : undefined} className={cn("@container flex flex-col gap-5", className)} {...props}>
      <Group title="Speed">
        {editable || SPEEDS.includes(value.pace) ? (
          // Every table has the slider: the visitor who sets the lobby moves it, the one who reads a table of the list sees where it stands and cannot press it
          <ToggleGroup
            type="single"
            variant="segmented"
            value={value.pace}
            disabled={!editable}
            onValueChange={(next) => next && change({ ...set, pace: next as Pace })}
            aria-label="Speed of the game"
            // It reaches 12px out of the column on each side, as the cards of the expansions do, so that the two blocks have the same edges
            className="-mx-3 w-auto"
          >
            {SPEEDS.map((speed) =>
              speed === "none" ? (
                // No timer is an infinity and nothing else, narrower than the others, which share the rest of the width alike: its name is for a screen reader and for the pointer
                <ToggleGroupItem key={speed} value={speed} fit aria-label="No timer" title="No timer" className={cn("w-12 px-0", CHIP, READ)}>
                  <HugeiconsIcon icon={InfinityIcon} strokeWidth={2} className="size-4" aria-hidden="true" />
                </ToggleGroupItem>
              ) : (
                <ToggleGroupItem key={speed} value={speed} className={cn(CHIP, READ)}>
                  {PACES.find((pace) => pace.value === speed)?.label}
                </ToggleGroupItem>
              )
            )}
          </ToggleGroup>
        ) : (
          <p>{PACES.find((option) => option.value === value.pace)?.label}</p>
        )}
      </Group>
      {afterSpeed}
      {shown.length > 0 && (
        <Group title={editable ? "Expansions" : "Played with"}>
          <ul className="flex flex-col gap-2">
            {shown.map((expansion) => {
              const on = value.expansions.includes(expansion.id)
              return (
                <li key={expansion.id}>
                  <ExpansionCard
                    expansion={expansion}
                    chosen={on}
                    onChosenChange={editable ? (next) => change({ ...set, expansions: next ? [...set.expansions, expansion.id] : set.expansions.filter((id) => id !== expansion.id) }) : undefined}
                    onLockedPick={expansion.locked && onLockedPick ? () => onLockedPick(expansion.id, expansion.locked!) : undefined}
                    settingsOn={set.expansionSettings[expansion.id]}
                    onSettingChange={(setting, enabled) => {
                      const current = set.expansionSettings[expansion.id] ?? []
                      change({ ...set, expansionSettings: { ...set.expansionSettings, [expansion.id]: enabled ? [...current, setting] : current.filter((id) => id !== setting) } })
                    }}
                  />
                </li>
              )
            })}
          </ul>
        </Group>
      )}
      {editable && helpers.length > 0 && (
        <Group title="Helpers">
          <ul className="flex flex-col gap-4">
            {helpers.map((helper) => (
              <SwitchRow
                key={helper.id}
                option={helper}
                on={set.helpers.includes(helper.id)}
                onChange={(on) => change({ ...set, helpers: on ? [...set.helpers, helper.id] : set.helpers.filter((id) => id !== helper.id) })}
              />
            ))}
          </ul>
        </Group>
      )}
    </div>
  )
}

export { LobbySettings }
export type { ExpansionFact, ExpansionLock, ExpansionOption, ExpansionTag, HelperOption, LobbySettingsProps, LobbySettingsValue, SettingOption }
