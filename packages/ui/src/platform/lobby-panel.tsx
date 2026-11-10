import * as React from "react"
import { ArrowRight01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "../utils"
import type { TableSeat, TableState } from "../tables"
import { Badge } from "./badge"
import { Button } from "./button"
import { Card, CardContent, CardDescription, CardFooter, CardTitle } from "./card"
import { LobbyAccess, type LobbyAccessProps } from "./lobby-access"
import { LobbyPlayers } from "./lobby-players"
import { LobbySettings, type LobbySettingsProps } from "./lobby-settings"
import type { OpenSeatProps } from "./open-seat"

// The tall space beside the open tables of a game, where a visitor plays: the lobby they are in, a table they picked in the list, or, when they are in none and have picked none, the space to open one. At its top right, when the lobby is the visitor's, one button
// says who may join it and sets it (`LobbyAccess`); under it the number of players and the seats (`LobbyPlayers`); and right under the seats, with a hairline between, the settings of the game (`LobbySettings`: the speed, the expansions, the helpers). It is a `Card` taller than the cards of a list (a roomier
// `--card-spacing`) that is as tall as what it holds, and as the row it stands in when that is taller: it never scrolls. What it holds is one block at the top, its parts as far apart as a gap and no more, and its footer, the main button and the one beside it, stays at the bottom: the room that is left is between the two.
// It is built from the parts of a card (`CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`) and from the pieces below; what it says, what its settings are and where its button leads are the page's.

/**
 * The panel: a `Card` that fills the height of the row it stands in and grows with its content, which never scrolls, and is not shorter than 44rem from `lg` when nothing gives it a height. `flat` is for a panel that stands
 * inside a container that has the look of a card already, beside the list of the open tables: it keeps the room and the parts of a card and draws no surface, no ring, no shadow and no corner of its own.
 */
function LobbyPanel({ className, flat = false, ...props }: React.ComponentProps<typeof Card> & { flat?: boolean }) {
  return (
    <Card
      data-slot="lobby-panel"
      className={cn("@container h-full gap-6 [--card-spacing:--spacing(8)] *:data-[slot=card-content]:flex-1 lg:min-h-176", flat && "rounded-none bg-transparent shadow-none! ring-0", className)}
      {...props}
    />
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
  /** Who opened the table, as the line at the top says it ("you", "Marly"): "Table created by Marly (3/5)". The visitor who sets the lobby has the number of players there instead. */
  createdBy: string
  /** What the table is called: "Your lobby", "Marly's table". Not drawn: it names the panel for a screen reader. */
  title: string
  /** The table's code, and what to do with it. Not drawn either: a screen reader reads it after the name. */
  description: string
  /** Every seat of the table in order, `null` for one nobody has taken. */
  seats: readonly TableSeat[]
  /** The settings of the table, under the seats: how fast it is played and the expansions it is played with. None: the panel has none to show. */
  settings?: LobbySettingsProps | null
  /** Who may join the table, for the visitor's own lobby, which they set: the one button at the top right (`LobbyAccess`), with where it starts, the languages it offers and what the page does with a choice (`onChange`). None: not drawn, as for every table of the list. */
  access?: Pick<LobbyAccessProps, "defaultVisibility" | "defaultMinRank" | "defaultLanguage" | "languages" | "onChange">
  /** How many players the visitor's own lobby may be set for: the select above the seats (`LobbyPlayers`). None: the seats are drawn as they are, as for every table of the list. */
  playerRange?: { min: number; max: number }
  /** What the page does with a number of players that the visitor picks (`LobbyPlayers`), for the lobby that is theirs. */
  onPlayersChange?: (count: number) => void
  /** What a table of the list asks of the people who sit at it ("Silver and above", "French"), already worded, as small tags under its seats. None: it asks nothing. The visitor's own lobby has them in the button that says who may join. */
  criteria?: readonly string[]
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
 * A table in the panel: at the top left a line that says who opened it and how many sit at it of how many it has (its name and its code are for a screen reader), or, when the lobby is the visitor's, the number of players to set; its people, five to a row (`LobbyPlayers`); its settings right under them
 * (`LobbySettings`), and, at the foot of the panel, the main button: the way into the table, a button that cannot be pressed and says that it waits to be started and how many have joined of those expected, or, for the one who opened it, the one that starts it (`start`). It is the lobby a visitor
 * sits at, which they may leave by the secondary button beside the main one (`leave`) and, when it is theirs, set who may join by the button at the top right (`access`), and the table they picked in the list of the open tables, which a button at the top right closes (`onClose`)
 * and gives the panel back to what it showed before.
 */
function LobbyDetail({ state, createdBy, title, description, seats, settings, access, playerRange, onPlayersChange, criteria, action, start, onClose, leave, join, invite, ...props }: LobbyDetailProps) {
  // At the right of the top row: who may join, for the visitor's own lobby, and the way to put a table that was picked down
  const actions =
    access || onClose ? (
      <>
        {access && <LobbyAccess {...access} />}
        {onClose && (
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Close the details" onClick={onClose}>
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} aria-hidden="true" />
          </Button>
        )}
      </>
    ) : undefined
  return (
    <LobbyPanel data-state={state} {...props}>
      {/* Its name and its code are for a screen reader (they name the panel): the line at the top says who opened the table and the seats who is at it */}
      <CardTitle className="ph-mask sr-only">{title}</CardTitle>
      <CardDescription className="ph-mask sr-only">{description}</CardDescription>
      <CardContent className="flex flex-col gap-6">
        <LobbyPlayers seats={seats} range={playerRange} onCountChange={onPlayersChange} createdBy={createdBy} actions={actions} join={join} invite={invite} />
        {criteria && criteria.length > 0 && (
          <ul aria-label="What the table asks" className="-mt-2 flex flex-wrap gap-2">
            {criteria.map((criterion) => (
              <li key={criterion}>
                <Badge variant="outline">{criterion}</Badge>
              </li>
            ))}
          </ul>
        )}
        {settings && <LobbySettings {...settings} className="border-t pt-6" />}
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

export { LobbyDetail, LobbyMainButton, LobbyPanel, LobbySideButton }
export type { LobbyDetailProps }
