"use client"

import { useCursor } from "@react-three/drei"
import { type ReactNode, useState } from "react"
import { useGame } from "@pbgo/core/components/game/context"
import { useSeatTheme } from "@pbgo/core/components/game/seat-label"
import { useSkin } from "@pbgo/core/components/skin-provider"
import { shortName } from "@pbgo/core/lib/short-name"
import { seatFontFamily } from "@pbgo/core/lib/seat-avatar-canvas"
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

/** The height above the table of the aura, of the plane that makes a plate a click target and of the lettering: the aura lies under the lettering, and all under the cards */
const AURA_Y = 0.015
const HIT_Y = 0.02
const TEXT_Y = 0.03

/** The name of a seat under the pointer: cream, with the seat colour in its relief and its glow */
const POINTED_INK = "#fff4dc"

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
  /** The player is out of the game or of the round: the plate fades and the name is struck */
  out?: boolean
  /** A winner: the aura lights */
  winner?: boolean
  /** The line under the name, already written in the visitor's language: the score */
  line?: string
  /** A word under the line (Frozen, Stayed), written the same way */
  status?: string
  /** The crown's icon, the skin's `hostIcon`; without one, a drawn crown */
  crownIcon?: string | null
  /** The CSS font of the lettering; `TABLE_FONT` by default */
  font?: string
  /** The aura's look; default `WINNER_AURA_SETTINGS` */
  aura?: AuraSettings
  /** What is changed in the name's style (colour, effects), in the line's and in the status's */
  nameStyle?: Partial<TextStyle>
  lineStyle?: Partial<TextStyle>
  statusStyle?: Partial<TextStyle>
  /** Makes the whole plate a click target to choose this player: the name lights up under the pointer */
  onSelect?: () => void
  /** What else stands at the seat, in the world's frame: the cards held there */
  children?: ReactNode
}

/**
 * The plate of a player at the table: the aura under it, the name in the seat colour with the avatar and, on the avatar's corner, the turn crown, and the
 * lines under it for the score and the status. Everything is `TableText`, `SeatAvatarMesh`, `Aura` and `TurnCrown` laid out by `plateOf`.
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
  out = false,
  winner = false,
  line,
  status,
  crownIcon,
  font,
  aura = WINNER_AURA_SETTINGS,
  nameStyle,
  lineStyle,
  statusStyle,
  onSelect,
  children,
}: SeatProps) {
  // The plate follows `SEAT_SETTINGS` as the knobs of the debug panel move them, and the panel can mark where the seat is
  useSettingsVersion()
  const S = SEAT_SETTINGS
  const plate = plateOf(spot, viewer, S)
  const [pointed, setPointed] = useState(false)
  const lit = onSelect !== undefined && pointed
  useCursor(lit)
  const opacity = away || out ? S.awayOpacity : 1
  const name: TextStyle = { color, shadow: "rgba(0,0,0,0.6)|12|4", ...(out ? { strike: true } : {}), ...nameStyle }
  const look: TextStyle = lit ? { ...name, shadow: undefined, color: POINTED_INK, relief: color, aura: color } : name
  // Before the name, or after it for a right-hand seat; the crown stands on the avatar's corner, in the same frame
  const avatar = (
    <>
      <SeatAvatarMesh nickname={nickname} color={color} imageUrl={imageUrl} theme={theme} size={S.avatarSize} position={[plate.avatarX, 0, 0]} opacity={opacity} />
      <TurnCrown show={active} icon={crownIcon} size={S.crownSize} position={[plate.crownX, 0, plate.crownZ]} />
    </>
  )
  // The plate is a click target as a whole: the plane under it takes the pointer on its own area, and the name, nearer and sometimes wider, on its own. R3F hands the hover over from one to the other, so the plate stays lit across both
  return (
    <group>
      <Aura width={S.auraWidth} depth={S.auraDepth} position={[plate.x, AURA_Y, plate.z]} yaw={0} force={auraForce({ active, waiting, hovered: lit, winner }, S)} color={color} settings={aura} />
      {onSelect && (
        <mesh
          position={[plate.x, HIT_Y, plate.z]}
          rotation-x={-Math.PI / 2}
          onClick={(e) => {
            e.stopPropagation()
            onSelect()
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            setPointed(true)
          }}
          onPointerOut={() => setPointed(false)}
        >
          <planeGeometry args={[S.auraWidth, S.auraDepth]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      <TableText
        text={shortName(nickname).toUpperCase()}
        style={look}
        height={S.nameHeight}
        position={[plate.x, TEXT_Y, plate.nameZ]}
        font={font}
        opacity={opacity}
        onClick={onSelect}
        onHover={onSelect ? setPointed : undefined}
        trailing={plate.after ? avatar : undefined}
      >
        {!plate.after && avatar}
      </TableText>
      {line !== undefined && (
        <TableText text={line} style={{ color: "#f5f2ea", weight: 700, ...lineStyle }} height={S.lineHeight} position={[plate.x, TEXT_Y, plate.lineZ]} font={font} opacity={opacity} />
      )}
      {status !== undefined && (
        <TableText text={status} style={{ color: "#f5f2ea", weight: 700, ...statusStyle }} height={S.statusHeight} position={[plate.x, TEXT_Y, plate.statusZ]} font={font} opacity={opacity} />
      )}
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
  return <Seat nickname={nickname(id)} color={color(id)} imageUrl={avatarUrl(id)} theme={theme} crownIcon={hostIcon} font={seatFontFamily(theme.font)} {...state} {...props} />
}
