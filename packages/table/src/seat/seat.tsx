"use client"

import type { ReactNode } from "react"
import { useGame } from "@pbgo/core/components/game/context"
import { useSeatTheme } from "@pbgo/core/components/game/seat-label"
import { useSkin } from "@pbgo/core/components/skin-provider"
import type { SeatTheme } from "@pbgo/core/lib/ui-theme"
import type { Spot } from "../layout"
import { Aura, type AuraSettings, WINNER_AURA_SETTINGS } from "./aura"
import { TurnCrown } from "./crown"
import { auraForce, plateOf, SEAT_SETTINGS } from "./placement"
import { SeatAvatarMesh } from "./seat-avatar-mesh"
import { TableText, type TextStyle } from "./table-text"

/** The height above the table of the aura and of the lettering: the aura lies under the lettering, and both under the cards */
const AURA_Y = 0.015
const TEXT_Y = 0.03

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
  /** The player of the turn: the crown shows and the aura lights */
  active?: boolean
  /** A winner: the aura lights (the turn wins when both hold) */
  winner?: boolean
  /** The line under the name, already written in the visitor's language: the score */
  line?: string
  /** The crown's icon, the skin's `hostIcon`; without one, a drawn crown */
  crownIcon?: string | null
  /** The CSS font of the lettering; default `TABLE_FONT` */
  font?: string
  /** The aura's look; default `WINNER_AURA_SETTINGS` */
  aura?: AuraSettings
  /** What is changed in the name's style (colour, effects) and in the line's */
  nameStyle?: Partial<TextStyle>
  lineStyle?: Partial<TextStyle>
  /** What else stands at the seat, in the world's frame: the cards held there */
  children?: ReactNode
}

/**
 * The plate of a player at the table: the aura under it, the name in the seat colour with the avatar and the turn crown beside it, and a line under it
 * for the score. Everything is `TableText`, `SeatAvatarMesh`, `Aura` and `TurnCrown` laid out by `plateOf`.
 */
export function Seat({ nickname, color, imageUrl, theme, spot, viewer = false, active = false, winner = false, line, crownIcon, font, aura = WINNER_AURA_SETTINGS, nameStyle, lineStyle, children }: SeatProps) {
  const S = SEAT_SETTINGS
  const plate = plateOf(spot, viewer, S)
  const avatar = <SeatAvatarMesh nickname={nickname} color={color} imageUrl={imageUrl} theme={theme} size={S.avatarSize} position={[plate.avatarX, 0, 0]} />
  return (
    <group>
      <Aura width={S.auraWidth} depth={S.auraDepth} position={[plate.x, AURA_Y, plate.z]} yaw={0} force={auraForce({ active, winner }, S)} color={color} settings={aura} />
      <TableText
        text={nickname.toUpperCase()}
        style={{ color, shadow: "rgba(0,0,0,0.6)|12|4", ...nameStyle }}
        height={S.nameHeight}
        position={[plate.x, TEXT_Y, plate.nameZ]}
        font={font}
        trailing={plate.after ? avatar : undefined}
      >
        {/* left of the first letter: the avatar (but for a right-hand seat), then the turn crown */}
        {!plate.after && avatar}
        <TurnCrown show={active} icon={crownIcon} position={[plate.crownX, 0, 0]} />
      </TableText>
      {line !== undefined && (
        <TableText text={line} style={{ color: "#f5f2ea", weight: 700, ...lineStyle }} height={S.lineHeight} position={[plate.x, TEXT_Y, plate.lineZ]} font={font} />
      )}
      {children}
    </group>
  )
}

/** The `Seat` of a player of the table: nickname, seat colour, account picture, seat theme and crown icon come from the platform, as for the seat label in the DOM (`PlayerSeatLabel`). */
export function PlayerSeat({ id, ...props }: { id: string } & Omit<SeatProps, "nickname" | "color" | "imageUrl" | "theme" | "crownIcon">) {
  const { nickname, color, avatarUrl } = useGame()
  const theme = useSeatTheme()
  const { hostIcon } = useSkin()
  return <Seat nickname={nickname(id)} color={color(id)} imageUrl={avatarUrl(id)} theme={theme} crownIcon={hostIcon} {...props} />
}
