import * as React from "react"
import { ArrowRight01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "../utils"
import type { TableSeat, TableState } from "../tables"
import { Button } from "./button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card"
import { LobbyAccess, type LobbyAccessProps } from "./lobby-access"
import { LobbyPlayers } from "./lobby-players"
import { LobbySeats } from "./lobby-seats"
import { LobbySettings, type LobbySettingsProps } from "./lobby-settings"
import type { OpenSeatProps } from "./open-seat"

// The tall space beside the open tables of a game, where a visitor plays: the lobby they are in, a table they picked in the list, or, when they are in none and have picked none, the space to open one. At its top right, when the lobby is the visitor's, one button
// says who may join it and sets it (`LobbyAccess`); under it the number of players and the seats (`LobbyPlayers`); at its bottom the settings of the game (`LobbySettings`: the speed, the expansions, the helpers). It is a `Card` taller than the cards of a list (a roomier
// `--card-spacing`) that is as tall as what it holds, and as the row it stands in when that is taller: it never scrolls. Its header stays at the top and its footer, the main button and the one beside it, at the bottom, and its content takes the room that is left between them.
// It is built from the parts of a card (`CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`) and from the pieces below; what it says, what its settings are and where its button leads are the page's.

/** The panel: a `Card` that fills the height of the row it stands in and grows with its content, which never scrolls, and is not shorter than 32rem from `lg` when nothing gives it a height. */
function LobbyPanel({ className, ...props }: React.ComponentProps<typeof Card>) {
  return (
    <Card
      data-slot="lobby-panel"
      className={cn("@container h-full gap-6 [--card-spacing:--spacing(8)] *:data-[slot=card-content]:flex-1 lg:min-h-128", className)}
      {...props}
    />
  )
}

type LobbySettingProps = Omit<React.ComponentProps<"div">, "title"> & {
  /** What the setting is ("Expansion"). */
  label: string
  /** A line more, quiet, under the label. */
  description?: string
}

/**
 * One setting of a lobby as a row: its name on the left, and on the right what it is set to (a word) or the control that sets it (a switch, a select, a group of chips). The rows of a panel are separated by a hairline. A control inside gives itself
 * a name (`aria-label`), since the label here is not a `<label>`. The settings of a game's lobby are not rows but groups (`LobbySettings`), since an expansion is a picture; the row stays for a setting that is one word and one control.
 */
function LobbySetting({ label, description, className, children, ...props }: LobbySettingProps) {
  return (
    <div data-slot="lobby-setting" className={cn("flex items-center justify-between gap-4 border-t py-3 first:border-t-0 first:pt-0 last:pb-0", className)} {...props}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm">{label}</span>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-sm">{children}</div>
    </div>
  )
}

/** The main button at the bottom of a lobby's panel: an `xl` button, like the way in of the space that opens one, and all the room that the secondary button beside it leaves. */
function LobbyMainButton({ className, ...props }: Omit<React.ComponentProps<typeof Button>, "size">) {
  return <Button size="xl" className={cn("min-w-0 flex-1", className)} {...props} />
}

/** A secondary button beside the main one: a square of the same height with an icon alone, which leaves the lobby. Its name is for screen readers and for the pointer (`aria-label`, `title`), which the caller gives. */
function LobbySideButton({ className, ...props }: Omit<React.ComponentProps<typeof Button>, "size" | "variant">) {
  return <Button variant="secondary" size="icon-xl" className={className} {...props} />
}

type LobbyDetailProps = Omit<React.ComponentProps<typeof LobbyPanel>, "title"> & {
  /** `waiting`: it waits for players. `playing`: it is being played. */
  state: TableState
  /** When it was opened, or how long it has been played: already formatted ("Opened 4 min ago"). */
  age: string
  /** Who opened the table, as the line at the top says it ("you", "Marly"): "Table created by you". */
  createdBy: string
  /** What the table is called: "Your lobby", "Marly's table". Not drawn: it names the panel for a screen reader. */
  title: string
  /** The table's code, and what to do with it. Not drawn either: a screen reader reads it after the name. */
  description: string
  /** Every seat of the table in order, `null` for one nobody has taken. */
  seats: readonly TableSeat[]
  /** The settings of the table, at the bottom: the expansions it is played with and how fast. None: the panel has none to show. */
  settings?: LobbySettingsProps | null
  /** Who may join the table, for the visitor's own lobby, which they set: the one button at the top right (`LobbyAccess`), with where it starts and the languages it offers. None: not drawn, as for every table of the list, which is public. */
  access?: Pick<LobbyAccessProps, "defaultVisibility" | "defaultMinRank" | "defaultLanguage" | "languages">
  /** How many players the visitor's own lobby may be set for: the select above the seats (`LobbyPlayers`). None: the seats are drawn as they are, as for every table of the list. */
  playerRange?: { min: number; max: number }
  /** The main button at the bottom: where it leads (`href`), or a button that cannot be pressed (`disabled`: "Full", "Waiting to start · 3/5"). None: no button, unless `start` is given. */
  action?: { label: string; href?: string; disabled?: boolean } | null
  /** The main button of the visitor who opened the lobby, which starts it: the page's own (`StartGameButton`), drawn in place of `action`. */
  start?: React.ReactNode
  /** What the button that closes the details does. Without it there is none: the visitor's own lobby has nothing to close. */
  onClose?: () => void
  /** What leaves the lobby the visitor sits at, whoever opened it: the page's own button (`LeaveLobbyButton`), a secondary one drawn beside the main button, an icon alone (`LobbySideButton`). */
  leave?: React.ReactNode
  /** What the plus of a free seat does for a visitor who is not at the table: it joins it (`OpenSeat`). */
  join?: OpenSeatProps["join"]
  /** What the plus of a free seat does for a visitor who is at it: it opens the menu that invites a friend or copies the link. */
  invite?: OpenSeatProps["invite"]
}

/**
 * A table in the panel: who opened it and how long ago, in a small line at the top (its name and its code are for a screen reader), its people, five to a row (`LobbyPlayers`, with the number of them to set when the lobby is the visitor's), its settings at the bottom
 * (`LobbySettings`), and the main button under them: the way into the table, a button that cannot be pressed and says that it waits to be started and how many have joined of those expected, or, for the one who opened it, the one that starts it (`start`). It is the lobby a visitor
 * sits at, which they may leave by the secondary button beside the main one (`leave`) and, when it is theirs, set who may join by the button at the top right (`access`), and the table they picked in the list of the open tables, which a button at the top right closes (`onClose`)
 * and gives the panel back to what it showed before.
 */
function LobbyDetail({ state, age, createdBy, title, description, seats, settings, access, playerRange, action, start, onClose, leave, join, invite, ...props }: LobbyDetailProps) {
  return (
    <LobbyPanel data-state={state} {...props}>
      <CardHeader>
        {/* Its name and its code are for a screen reader (they name the panel): the line says who opened the table, how long ago or how long it has been played, and the seats who is at it */}
        <div className="flex min-h-8 items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm text-muted-foreground">
            Table created by <span className="text-foreground">{createdBy}</span> · {age.charAt(0).toLowerCase() + age.slice(1)}
          </p>
          {(access || onClose) && (
            <div className="flex shrink-0 items-center gap-2">
              {access && <LobbyAccess {...access} />}
              {onClose && (
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Close the details" onClick={onClose}>
                  <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} aria-hidden="true" />
                </Button>
              )}
            </div>
          )}
        </div>
        <CardTitle className="sr-only">{title}</CardTitle>
        <CardDescription className="sr-only">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <LobbyPlayers seats={seats} range={playerRange} join={join} invite={invite} />
        {settings && <LobbySettings {...settings} className="mt-auto border-t pt-6" />}
      </CardContent>
      {(action || start || leave) && (
        <CardFooter className="gap-3">
          {start ??
            (action &&
              (action.disabled || !action.href ? (
                <LobbyMainButton variant="secondary" disabled>
                  {action.label}
                </LobbyMainButton>
              ) : (
                <LobbyMainButton asChild>
                  <a href={action.href}>
                    {action.label}
                    <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} data-icon="inline-end" aria-hidden="true" />
                  </a>
                </LobbyMainButton>
              )))}
          {leave}
        </CardFooter>
      )}
    </LobbyPanel>
  )
}

export { LobbyDetail, LobbyMainButton, LobbyPanel, LobbySeats, LobbySetting, LobbySideButton }
export type { LobbyDetailProps, LobbySettingProps }
