import * as React from "react"
import { ArrowRight01Icon, Cancel01Icon, Clock01Icon, PlayIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "../utils"
import type { TableSeat, TableState } from "../tables"
import { Badge } from "./badge"
import { Button } from "./button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card"
import { LobbySettings, type LobbySettingsProps } from "./lobby-settings"
import { OpenSeat, type OpenSeatProps } from "./open-seat"
import { RankBadge } from "./rank-badge"
import { SeatAvatar } from "./table-card"

// The tall space beside the open tables of a game, where a visitor plays: the lobby they are in, a table they picked in the list, or, when they are in none and have picked none, the space to open one, with the settings of the game at its bottom
// (the speed of the game, who may find it, the expansions: `LobbySettings`). It is a `Card` taller than the cards of a list (a roomier `--card-spacing`) that fills the height it is given: its header and its footer, the main button and the one beside it, stay in place and its content, which takes
// the height that is left, scrolls when it holds more than fits. It is built from the parts of a card (`CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`) and from the pieces below; what it says, what its settings are
// and where its button leads are the page's.

/** The panel: a `Card` that fills the height it is given, with a content that scrolls, and is not shorter than 32rem from `lg` when nothing gives it a height. */
function LobbyPanel({ className, ...props }: React.ComponentProps<typeof Card>) {
  return (
    <Card
      data-slot="lobby-panel"
      className={cn("@container h-full gap-6 [--card-spacing:--spacing(8)] *:data-[slot=card-content]:min-h-0 *:data-[slot=card-content]:flex-1 *:data-[slot=card-content]:overflow-y-auto lg:min-h-128", className)}
      {...props}
    />
  )
}

/**
 * The people of a lobby: a picture and a name for each, their rank in the game under the name (none for a guest, who has none), a "Host" badge on the one who opened it, and a dashed place that says it waits for a player for each seat
 * nobody has taken. One under another in a narrow panel, in two columns from 28rem (the panel is the container), so that a table of five does not take the height that its settings need. The picture opens the player's card under the pointer, which
 * says the rest. A table card shows the same seats in a row (`TableSeats`); a lobby has the room for their names.
 */
function LobbySeats({ seats, join, invite, className, ...props }: Omit<React.ComponentProps<"ul">, "children"> & { seats: readonly TableSeat[]; join?: OpenSeatProps["join"]; invite?: OpenSeatProps["invite"] }) {
  const firstFree = seats.indexOf(null)
  return (
    <ul data-slot="lobby-seats" aria-label="Players" className={cn("grid grid-cols-1 gap-x-8 gap-y-3 @md:grid-cols-2", className)} {...props}>
      {seats.map((seat, index) => (
        <li key={index} data-slot="lobby-seat" data-free={seat ? undefined : ""} className="flex items-center gap-3">
          {!seat && (join || invite) ? <OpenSeat join={join} invite={invite} tabbable={index === firstFree} /> : <SeatAvatar seat={seat} />}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className={cn("truncate", !seat && "text-muted-foreground")}>{seat ? seat.name : "Waiting for a player"}</span>
            {seat?.record && <RankBadge rank={seat.record.rank} quiet className="justify-start" />}
          </span>
          {seat?.host && <Badge variant="secondary">Host</Badge>}
        </li>
      ))}
    </ul>
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
  /** What the table is called: "Your lobby", "Marly's table". */
  title: string
  /** Under the title: the table's code, and what to do with it. */
  description: string
  /** Every seat of the table in order, `null` for one nobody has taken. */
  seats: readonly TableSeat[]
  /** The settings of the table, at the bottom: the expansions it is played with, how fast, and, for the visitor's own lobby, who may find it. None: the panel has none to show. */
  settings?: LobbySettingsProps | null
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
 * A table in the panel: whether it waits or is played and how old it is, its name and its code, its people one under another (`LobbySeats`, names included, which the rows of the list leave out), its settings at the bottom (`LobbySettings`), and
 * the main button under them: the way into the table, a button that cannot be pressed and says that it waits to be started and how many have joined of those expected, or, for the one who opened it, the one that starts it (`start`). It is
 * the lobby a visitor sits at, which they may leave by the secondary button beside the main one (`leave`), and the table they picked in the list of the open tables, which a button at the top closes (`onClose`) and gives the panel back
 * to what it showed before.
 */
function LobbyDetail({ state, age, title, description, seats, settings, action, start, onClose, leave, join, invite, ...props }: LobbyDetailProps) {
  const waiting = state === "waiting"
  return (
    <LobbyPanel {...props}>
      <CardHeader>
        <div className="mb-2 flex min-h-8 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Badge variant={waiting ? "outline" : "secondary"}>
              <HugeiconsIcon icon={waiting ? Clock01Icon : PlayIcon} strokeWidth={2} data-icon="inline-start" aria-hidden="true" />
              {waiting ? "Waiting" : "Playing"}
            </Badge>
            <span className="truncate text-sm text-muted-foreground">{age}</span>
          </div>
          {onClose && (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Close the details" onClick={onClose} className="shrink-0">
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} aria-hidden="true" />
            </Button>
          )}
        </div>
        <CardTitle className="text-3xl md:text-4xl">{title}</CardTitle>
        <CardDescription className="text-base">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <LobbySeats seats={seats} join={join} invite={invite} />
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
