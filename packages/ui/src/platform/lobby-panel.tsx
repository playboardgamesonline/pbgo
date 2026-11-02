import * as React from "react"
import { ArrowRight01Icon, Cancel01Icon, Clock01Icon, CrownIcon, PlayIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "../utils"
import type { TableSeat, TableState } from "../tables"
import { Badge } from "./badge"
import { Button } from "./button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card"
import { LobbySettings, type LobbySettingsProps } from "./lobby-settings"
import { LobbyAccess, LobbyVisibility, type LobbyVisibilityValue } from "./lobby-visibility"
import { OpenSeat, type OpenSeatProps } from "./open-seat"
import { SeatAvatar } from "./table-card"

// The tall space beside the open tables of a game, where a visitor plays: the lobby they are in, a table they picked in the list, or, when they are in none and have picked none, the space to open one, with the settings of the game at its bottom
// (the speed of the game and the expansions: `LobbySettings`), and, at its top right, who may find the lobby when it is the visitor's (`LobbyVisibility`, two icons in a toggle). It is a `Card` taller than the cards of a list (a roomier `--card-spacing`) that is as tall as what it holds, and as the row it stands in when
// that is taller: it never scrolls. Its header stays at the top and its footer, the main button and the one beside it, at the bottom, and its content takes the room that is left between them. It is built from the parts of a card (`CardHeader`, `CardTitle`, `CardDescription`, `CardContent`,
// `CardFooter`) and from the pieces below; what it says, what its settings are and where its button leads are the page's.

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

/** The picture of a seat: 40px in a narrow panel, 56px from 28rem (the panel is the container). */
const SEAT_PICTURE = "size-10 @md:size-14"

/**
 * The people of a lobby, five to a row, as many seats as the table was set for (at most three rows, fifteen): the picture of each player with their name under it (cut with an ellipsis when it does not fit), a crown over the one who opened the table, and, for each seat
 * nobody has taken, a dashed place with a plus in it that does what the seat is for (`OpenSeat`: it joins the table, or, at the table the visitor sits at, opens a menu to invite a friend or copy the link) and, under it, what it does. They are the blocks of a row of the list
 * (`TableEntry`), larger and with the room that a panel has for five. The pointer finds a player's card on their picture, which says the rest (rank, record). A table of two or three has its seats at the left, in the columns of a table of five.
 */
function LobbySeats({ seats, join, invite, className, ...props }: Omit<React.ComponentProps<"ul">, "children"> & { seats: readonly TableSeat[]; join?: OpenSeatProps["join"]; invite?: OpenSeatProps["invite"] }) {
  const firstFree = seats.indexOf(null)
  const word = invite ? "Invite" : join ? "Join" : "Open"
  return (
    <ul data-slot="lobby-seats" aria-label="Players" className={cn("grid grid-cols-5 gap-x-2 gap-y-6", className)} {...props}>
      {seats.map((seat, index) => (
        <li key={index} data-slot="lobby-seat" data-free={seat ? undefined : ""} className="flex min-w-0 flex-col items-center gap-1.5">
          <span className="relative">
            {seat?.host && <HugeiconsIcon icon={CrownIcon} strokeWidth={2} aria-hidden="true" className="absolute -top-3 left-1/2 z-10 size-4 -translate-x-1/2 @md:-top-4 @md:size-5" />}
            {seat ? <SeatAvatar seat={seat} className={SEAT_PICTURE} /> : <OpenSeat join={join} invite={invite} tabbable={index === firstFree} className={SEAT_PICTURE} />}
          </span>
          <span className={cn("w-full truncate text-center text-xs", !seat && "text-muted-foreground")}>
            {seat?.host && <span className="sr-only">Host: </span>}
            {seat ? seat.name : word}
          </span>
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
  /** What the table is called: "Your lobby", "Marly's table". Not drawn: it names the panel for a screen reader. */
  title: string
  /** The table's code, and what to do with it. Not drawn either: a screen reader reads it after the name. */
  description: string
  /** Every seat of the table in order, `null` for one nobody has taken. */
  seats: readonly TableSeat[]
  /** The settings of the table, at the bottom: the expansions it is played with and how fast. None: the panel has none to show. */
  settings?: LobbySettingsProps | null
  /** Who may find the table, for the visitor's own lobby, which they set: a toggle of two icons at the top right (`LobbyVisibility`). None: not drawn, as for every table of the list, which is public. */
  visibility?: LobbyVisibilityValue
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
 * A table in the panel: whether it waits or is played and how old it is (its name and its code are for a screen reader), its people, five to a row (`LobbySeats`), its settings at the bottom (`LobbySettings`), and
 * the main button under them: the way into the table, a button that cannot be pressed and says that it waits to be started and how many have joined of those expected, or, for the one who opened it, the one that starts it (`start`). It is
 * the lobby a visitor sits at, which they may leave by the secondary button beside the main one (`leave`) and, when it is theirs, set who may find it by the toggle at the top right (`visibility`), and the table they picked in the list of the open tables, which a button at the top
 * right closes (`onClose`) and gives the panel back to what it showed before.
 */
function LobbyDetail({ state, age, title, description, seats, settings, visibility, action, start, onClose, leave, join, invite, ...props }: LobbyDetailProps) {
  const waiting = state === "waiting"
  const panel = (
    <LobbyPanel {...props}>
      <CardHeader>
        {/* Its name and its code are for a screen reader (they name the panel): the status row says what the table is and the seats who is at it */}
        <div className="flex min-h-8 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Badge variant={waiting ? "outline" : "secondary"}>
              <HugeiconsIcon icon={waiting ? Clock01Icon : PlayIcon} strokeWidth={2} data-icon="inline-start" aria-hidden="true" />
              {waiting ? "Waiting" : "Playing"}
            </Badge>
            <span className="truncate text-sm text-muted-foreground">{age}</span>
          </div>
          {(visibility || onClose) && (
            <div className="flex shrink-0 items-center gap-2">
              {visibility && <LobbyVisibility />}
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
  // A lobby that the visitor sets keeps who may find it for the toggle at its top and the criteria of its settings, which only a public lobby asks for
  return visibility ? <LobbyAccess defaultVisibility={visibility}>{panel}</LobbyAccess> : panel
}

export { LobbyDetail, LobbyMainButton, LobbyPanel, LobbySeats, LobbySetting, LobbySideButton }
export type { LobbyDetailProps, LobbySettingProps }
