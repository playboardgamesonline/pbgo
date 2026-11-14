"use client"

import type { ReactNode } from "react"
import { useGame } from "@pbgo/core/components/game/context"
import { useSeatTheme } from "@pbgo/core/components/game/seat-label"
import { useSkin } from "@pbgo/core/components/skin-provider"
import { shortName } from "@pbgo/core/lib/short-name"
import type { SeatTheme } from "@pbgo/core/lib/ui-theme"
import { SeatGizmo } from "../debug/gizmos"
import { useSettingsVersion } from "../debug/settings"
import { DEBUG_VIEW } from "../debug/view"
import type { Spot } from "../layout"
import { Aura, type AuraSettings, WINNER_AURA_SETTINGS } from "./aura"
import { TurnCrown } from "./crown"
import { auraForce, plateOf, SEAT_SETTINGS } from "./placement"
import { SeatAvatarMesh } from "./seat-avatar-mesh"
import { seatStateOf } from "./state"
import { TableText, type TextStyle } from "./table-text"

/** The height above the table of the aura and of the lettering: the aura lies under the lettering, and all under the cards */
const AURA_Y = 0.015
const TEXT_Y = 0.03

/** The font of the plate's lettering: Geist, the platform's own, a variable font (fontsource, `@fontsource-variable/geist`), so that the weight asked for is the weight drawn */
export const PLATE_FONT = '"Geist Variable", "Geist", ui-sans-serif, system-ui, sans-serif'
/** The weight of the name and of the info line: the platform's 600 */
export const PLATE_WEIGHT = 600

export type SeatProps = {
  nickname: string
  /** The seat colour: the name, the avatar until a picture exists, and the aura */
  color: string
  /** The account's picture; absent: the avatar is generated */
  imageUrl?: string | null
  /** How the game dresses its seat avatars (`UI_THEME.seat`, read with `useSeatTheme()`) */
  theme: SeatTheme
  /** The seat's spot on the ring (`seats()`): the plate stands out from it by `SEAT_SETTINGS` */
  spot: Spot
  /** The viewer's own seat, whose plate stands level with its spot instead of beyond it */
  viewer?: boolean
  /** The player of the turn: the crown shows */
  active?: boolean
  /** One of several players the game waits for at once: the aura lights softly */
  waiting?: boolean
  /** The player is away: the plate fades */
  away?: boolean
  /** A winner: the aura lights */
  winner?: boolean
  /** The info line under the name, already written in the visitor's language: the score ("132 pts") */
  line?: string
  /** A word on the same info line, after the score (Frozen, Stayed), plain text, written the same way */
  status?: string
  /** What stands to the right of the name, in a frame whose origin is the name's right edge (`0.2` is just right of the last letter): tokens, a count, an icon. For a game whose players hold things (Love Letter's affection tokens) */
  trailing?: ReactNode
  /** The crown's icon, the skin's `hostIcon`; without one, a drawn crown */
  crownIcon?: string | null
  /** The CSS font of the lettering; `PLATE_FONT` (Geist) by default */
  font?: string
  /** The aura's look; default `WINNER_AURA_SETTINGS` */
  aura?: AuraSettings
  /** What is changed in the name's style (colour, effects) and in the info line's */
  nameStyle?: Partial<TextStyle>
  lineStyle?: Partial<TextStyle>
  /** What else stands at the seat, in the world's frame: the cards held there */
  children?: ReactNode
}

/**
 * The plate of a player at the table, one block that turns as one: the avatar, then the name, on a first row (the avatar is always to the LEFT of the name, as the plate is read, whatever way the plate is turned: the block turns as one and a
 * plate more than a quarter turn from upright is turned back by half a turn as a whole), the info line under the name (the score, then a status as plain text), and a `trailing` slot to the right of the name. The turn crown stands on the avatar's
 * corner and the aura lies under all of it. The plate never reacts to the pointer: choosing a player is the job of the zone the plate lies in (`FloorButton`).
 */
export function Seat({
  nickname,
  color,
  imageUrl,
  theme,
  spot,
  viewer = false,
  active = false,
  waiting = false,
  away = false,
  winner = false,
  line,
  status,
  trailing,
  crownIcon,
  font = PLATE_FONT,
  aura = WINNER_AURA_SETTINGS,
  nameStyle,
  lineStyle,
  children,
}: SeatProps) {
  // The plate follows `SEAT_SETTINGS` as the knobs of the debug panel move them, and the panel can mark where the seat is
  useSettingsVersion()
  const S = SEAT_SETTINGS
  const plate = plateOf(spot, viewer, S)
  const opacity = away ? S.awayOpacity : 1
  const name: TextStyle = { color, shadow: "rgba(0,0,0,0.6)|12|4", weight: PLATE_WEIGHT, ...nameStyle }
  const info = [line, status].filter((part): part is string => !!part).join("  ·  ")
  // The avatar and the name are one block centred on the plate: the name's lettering stands half the avatar's width to the right of the centre, so that the avatar, at its left edge, brings the block back to the middle
  const shift = -plate.avatarX / 2
  return (
    <group>
      <Aura width={S.auraWidth} depth={S.auraDepth} position={[plate.x, AURA_Y, plate.z]} yaw={0} force={auraForce({ active, waiting, winner }, S)} color={color} settings={aura} />
      <TableText text={shortName(nickname)} style={name} height={S.nameHeight} position={[plate.x + shift, TEXT_Y, plate.nameZ]} font={font} opacity={opacity} trailing={trailing}>
        <SeatAvatarMesh nickname={nickname} color={color} imageUrl={imageUrl} theme={theme} size={S.avatarSize} position={[plate.avatarX, 0, 0]} opacity={opacity} />
        <TurnCrown show={active} icon={crownIcon} size={S.crownSize} position={[plate.crownX, 0, plate.crownZ]} />
      </TableText>
      {info !== "" && <TableText text={info} style={{ color: "#f5f2ea", weight: PLATE_WEIGHT, ...lineStyle }} height={S.lineHeight} position={[plate.x, TEXT_Y, plate.lineZ]} font={font} opacity={opacity} />}
      {DEBUG_VIEW.seats && <SeatGizmo spot={spot} plate={plate} />}
      {children}
    </group>
  )
}

/**
 * The `Seat` of a player of the table: with an `id` it takes the nickname, the seat colour, the account picture, the seat theme, the crown icon and the font of the seat
 * label from the platform, and what the table says of the player: the turn or the wait (`waitingFor`), away (`present`) and a winner (`results`). A prop of the same name wins.
 */
export function PlayerSeat({ id, ...props }: { id: string } & Omit<SeatProps, "nickname" | "color" | "imageUrl" | "theme" | "crownIcon">) {
  const { game, view, nickname, color, avatarUrl } = useGame()
  const theme = useSeatTheme()
  const { hostIcon } = useSkin()
  const state = seatStateOf({ status: game.status, waitingFor: game.waitingFor, present: game.present, winners: view.results?.winners ?? [] }, id)
  return <Seat nickname={nickname(id)} color={color(id)} imageUrl={avatarUrl(id)} theme={theme} crownIcon={hostIcon} {...state} {...props} />
}
