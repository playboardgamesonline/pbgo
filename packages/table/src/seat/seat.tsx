"use client"

import type { ReactNode } from "react"
import { useGame } from "@pbgo/core/components/game/context"
import { useSeatTheme } from "@pbgo/core/components/game/seat-label"
import { shortName } from "@pbgo/core/lib/short-name"
import type { SeatTheme } from "@pbgo/core/lib/ui-theme"
import type { TableBox } from "../box"
import { SeatGizmo } from "../debug/gizmos"
import { useSettingsVersion } from "../debug/settings"
import { DEBUG_VIEW } from "../debug/view"
import type { Spot } from "../layout"
import { TurnCrown } from "./crown"
import { plateAbove, plateOf, plateRow, SEAT_SETTINGS, type SeatSettings } from "./placement"
import { SeatAvatarMesh } from "./seat-avatar-mesh"
import { seatStateOf } from "./state"
import { TableText, type TextStyle, useTextWidth } from "./table-text"

/** The height above the table of the lettering */
const TEXT_Y = 0.03
/** Where the plate of a seat stands when it is given neither `above` nor a `spot`: the middle of the table, which is where a board that places the plate itself draws it, in a group of its own */
const ORIGIN: Spot = { x: 0, z: 0 }

/** The font of the plate's lettering: Geist, the platform's own, a variable font (fontsource, `@fontsource-variable/geist`), so that the weight asked for is the weight drawn */
export const PLATE_FONT = '"Geist Variable", "Geist", ui-sans-serif, system-ui, sans-serif'
/** The weight of the name and of the info line: the platform's 600 */
export const PLATE_WEIGHT = 600

export type SeatProps = {
  nickname: string
  /** The seat colour: the name, and the avatar until a picture exists */
  color: string
  /** The account's picture; absent: the avatar is generated */
  imageUrl?: string | null
  /** How the game dresses its seat avatars (`UI_THEME.seat`, read with `useSeatTheme()`) */
  theme: SeatTheme
  /**
   * The frame of the seat: where it is on the table and the way it faces (`yaw`, from `seats()`: the top of the frame, its least z, is toward the middle of the table, the way the player who sits there looks). The plate is drawn in it and turns with it, as the cards the
   * game lays in the same frame do. Default: the world's own frame
   */
  frame?: Spot
  /**
   * The box of all of the player's cards in that frame (`frameBoxOfPoses` of the kit): the plate stands above it, on the side of the cards that faces the middle of the table, centred on them, the viewer's seat and every other, whichever way the seat is turned. This is how a
   * seat is placed unless the game places it itself
   */
  above?: TableBox
  /** Where the plate stands when it has no `above`: the seat's spot on the ring (`seats()`), from which it stands out by `SEAT_SETTINGS`. Default: the middle of the frame, for a board that draws the seat in a group of its own */
  spot?: Spot
  /** The viewer's own seat, whose plate stands level with its spot instead of beyond it (only for a plate placed from its `spot`) */
  viewer?: boolean
  /** The player of the turn: the crown shows */
  active?: boolean
  /** The player is away: the plate fades */
  away?: boolean
  /** The info line under the name, already written in the visitor's language: the score ("132 pts") */
  line?: string
  /** A word on the same info line, after the score (Frozen, Stayed), plain text, written the same way */
  status?: string
  /** What stands to the right of the plate, in a frame whose origin is the right edge of its lettering, level with the middle of the avatar (`0.2` is just right of the longer line): tokens, a count, an icon. For a game whose players hold things (Love Letter's affection tokens) */
  trailing?: ReactNode
  /** The widest the name, and the info line, may be, in world units: a longer one shrinks to it, with its proportions. `SEAT_SETTINGS.nameRoom` by default, which only a name of wide capitals goes beyond */
  room?: number
  /** The settings the plate follows: `SEAT_SETTINGS` unless a board makes its plates smaller at a bigger table (`scaledSeat`), in which case the layout that places them is given the same */
  settings?: SeatSettings
  /** The CSS font of the lettering; `PLATE_FONT` (Geist) by default */
  font?: string
  /** What is changed in the name's style (colour, effects) and in the info line's */
  nameStyle?: Partial<TextStyle>
  lineStyle?: Partial<TextStyle>
  /** What else stands at the seat, in the world's frame: the cards held there */
  children?: ReactNode
}

/**
 * The plate of a player at the table, one block that turns as one: the avatar at the left (always to the LEFT of the lettering, as the plate is read), and beside it the name with the info line under it, left-aligned (the score, then a status as plain text, side by side), and a
 * `trailing` slot to the right of the lettering. The avatar stands level with the middle of the two lines, or with the name when it stands alone. The turn crown stands centred above the avatar, as the camera sees it. Nothing lies under the plate: no light, no tint, in any state. The plate never
 * reacts to the pointer: choosing a player is the job of the `Hotspot` over their cards.
 *
 * It stands above the player's cards (`above`), in the frame of the seat: on the side of the cards that faces the middle of the table, turned with the seat, so that the name is read over the cards by the player who sits there, at every seat.
 */
export function Seat({
  nickname,
  color,
  imageUrl,
  theme,
  frame = ORIGIN,
  above,
  spot = ORIGIN,
  viewer = false,
  active = false,
  away = false,
  line,
  status,
  trailing,
  room,
  settings,
  font = PLATE_FONT,
  nameStyle,
  lineStyle,
  children,
}: SeatProps) {
  // The plate follows `SEAT_SETTINGS` as the knobs of the debug panel move them, and the panel can mark where the seat is
  useSettingsVersion()
  const S = settings ?? SEAT_SETTINGS
  const plate = above ? plateAbove(above, S) : plateOf(spot, viewer, S)
  const opacity = away ? S.awayOpacity : 1
  const name: TextStyle = { color, shadow: "rgba(0,0,0,0.6)|12|4", weight: PLATE_WEIGHT, ...nameStyle }
  const info = [line, status].filter((part): part is string => !!part).join("  ·  ")
  const nameText = shortName(nickname)
  const lineStyleOf: TextStyle = { color: "#f5f2ea", weight: PLATE_WEIGHT, ...lineStyle }
  // the block of the avatar and the two lines of lettering is centred on the plate, so the widths of the lettering place everything: both lines are held to the same room
  const roomOf = room ?? S.nameRoom
  const nameWidth = useTextWidth(nameText, name, S.nameHeight, font, roomOf)
  const infoWidth = useTextWidth(info, lineStyleOf, S.lineHeight, font, roomOf)
  const row = plateRow(plate, { name: nameWidth, info: info === "" ? null : infoWidth }, S)
  return (
    <group>
      <group position={[frame.x, 0, frame.z]} rotation-y={frame.yaw ?? 0}>
        <group position={[row.avatarX, TEXT_Y, plate.z]}>
          <SeatAvatarMesh nickname={nickname} color={color} imageUrl={imageUrl} theme={theme} size={S.avatarSize} position={[0, 0, 0]} opacity={opacity} />
          <TurnCrown show={active} size={S.crownSize} position={[0, 0, 0]} reach={S.avatarSize / 2 + S.crownGap} yaw={frame.yaw ?? 0} />
        </group>
        <TableText text={nameText} style={name} height={S.nameHeight} maxWidth={roomOf} position={[row.textX + nameWidth / 2, TEXT_Y, row.nameZ]} font={font} opacity={opacity} capsCentred />
        {info !== "" && <TableText text={info} style={lineStyleOf} height={S.lineHeight} maxWidth={roomOf} position={[row.textX + infoWidth / 2, TEXT_Y, plate.lineZ]} font={font} opacity={opacity} capsCentred />}
        {trailing && <group position={[row.endX, TEXT_Y, plate.z]}>{trailing}</group>}
        {DEBUG_VIEW.seats && <SeatGizmo spot={above ? undefined : spot} plate={plate} cards={above} />}
      </group>
      {children}
    </group>
  )
}

/**
 * The `Seat` of a player of the table: with an `id` it takes the nickname, the seat colour, the account picture, the seat theme and the font of the seat
 * label from the platform, and what the table says of the player: the turn (`waitingFor`) and away (`present`). A prop of the same name wins.
 */
export function PlayerSeat({ id, ...props }: { id: string } & Omit<SeatProps, "nickname" | "color" | "imageUrl" | "theme">) {
  const { game, view, nickname, color, avatarUrl } = useGame()
  const theme = useSeatTheme()
  const { active, away } = seatStateOf({ status: game.status, waitingFor: game.waitingFor, present: game.present, winners: view.results?.winners ?? [] }, id)
  return <Seat nickname={nickname(id)} color={color(id)} imageUrl={avatarUrl(id)} theme={theme} active={active} away={away} {...props} />
}
