"use client"

import { usePrefersReducedMotion } from "@pbgo/core/lib/use-motion"
import { useCursor } from "@react-three/drei"
import { type ThreeEvent, useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef, useState } from "react"
import { MeshBasicMaterial } from "three"
import { useSettingsVersion } from "../debug/settings"
import { TableText } from "../seat/table-text"
import { edgePlace } from "./points"
import { ROAD_MAP_SETTINGS } from "./settings"

/** What a place shows: its colour, a label written on it in its ink, and `hidden` for a place that is drawn only while it can be chosen or is under the pointer. A field left out is the map's own */
export type PlaceLook = { color?: string; label?: string; ink?: string; hidden?: boolean }

/** What a road shows: its colour, which says that it belongs to somebody and draws it wider, and `hidden` for a road that is drawn only while it can be chosen or is under the pointer */
export type RoadLook = { color?: string; hidden?: boolean }

/** A place or a road, by its number */
export type RoadMapTarget = { kind: "place" | "road"; index: number }

export type RoadMapProps = {
  /** Where each place lies on the table: `hexPoints` and `squarePoints` make them for the corners of a board, and a game gives the places of its own map. Keep the list from one render to the next */
  places: readonly { x: number; z: number }[]
  /** The roads, each the two places it joins, by their number: the `edges` of the kit's `graph` or `cornerGraph` */
  roads: readonly (readonly [number, number])[]
  /** What each place and each road shows, from the game's state. Called for every one whenever the map is drawn */
  placeLook?: (index: number) => PlaceLook
  roadLook?: (index: number) => RoadLook
  /** The places and the roads that can be chosen now: a ring pulses on each place and a strip on each road, and only those can be pressed. Without it, nothing pulses and every place and every road can be pressed that has a handler */
  halo?: { places?: readonly number[]; roads?: readonly number[] } | null
  /** Pressing a place does this, with its number */
  onPlace?: (index: number) => void
  /** Pressing a road does this, with its number */
  onRoad?: (index: number) => void
  /** The pointer comes onto a place or a road that can be pressed, and leaves it (null) */
  onHover?: (target: RoadMapTarget | null) => void
  /** The colour of the places and of the roads that give none, of the labels, and of the rings and strips (a warm white by default) */
  color?: string
  ink?: string
  haloColor?: string
  /** The diameter of a place and the width of a road, in world units (default `ROAD_MAP_SETTINGS`) */
  placeSize?: number
  roadWidth?: number
}

// How high above the table each part lies: the roads, then the places on them, then the rings and strips of a choice, then the lettering
const ROAD_HEIGHT = 0.012
const PLACE_HEIGHT = 0.022
const HALO_HEIGHT = 0.026
const LABEL_HEIGHT = 0.03

const none = () => null

/**
 * A map on the table: places joined by roads. The places lie where the game puts them (the corners of a board with `hexPoints` and `squarePoints`, or the cities of a map it draws), and the roads run between them. A road that belongs to somebody is
 * drawn in their colour and wider, and a place can carry a label. What can be chosen now pulses, and is pressed. It draws no piece: a settlement, a train or a pawn is a `Piece` that the game stands on a place or lays along a road (`edgePlace`).
 * The structure is the engine's (`graph`, `cornerGraph` of the kit): the table gets the numbers of the places and the roads and tells the game which was pressed.
 */
export function RoadMap({ places, roads, placeLook, roadLook, halo = null, onPlace, onRoad, onHover, color = "#f4efe2", ink = "#26231f", haloColor = "#ffe9b0", placeSize, roadWidth }: RoadMapProps) {
  // Drawn again when the panel changes a setting
  useSettingsVersion()
  const S = ROAD_MAP_SETTINGS
  const size = placeSize ?? S.placeSize
  const line = roadWidth ?? S.roadWidth
  const reduced = usePrefersReducedMotion()
  const [hover, setHover] = useState<RoadMapTarget | null>(null)
  useCursor(hover !== null, "pointer")

  // The rings and the strips of a choice share two materials, one that pulses and one for what is under the pointer
  const pulsing = useMemo(() => new MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }), [])
  const held = useMemo(() => new MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false, opacity: 1 }), [])
  // What a frame changes is reached through a ref, as the pulse of a board is
  const live = useRef({ pulsing })
  useEffect(() => {
    live.current = { pulsing }
    pulsing.color.set(haloColor)
    held.color.set(haloColor)
  }, [haloColor, pulsing, held])
  useEffect(
    () => () => {
      pulsing.dispose()
      held.dispose()
    },
    [pulsing, held],
  )
  useFrame(({ clock }) => {
    live.current.pulsing.opacity = S.haloLow + (S.haloHigh - S.haloLow) * (reduced ? 1 : 0.5 + 0.5 * Math.sin(clock.elapsedTime * S.pulseSpeed))
  })

  const choosablePlaces = halo?.places ? new Set(halo.places) : null
  const choosableRoads = halo?.roads ? new Set(halo.roads) : null
  const placePressable = (index: number) => !!onPlace && (halo === null || choosablePlaces?.has(index) === true)
  const roadPressable = (index: number) => !!onRoad && (halo === null || choosableRoads?.has(index) === true)
  const enter = (target: RoadMapTarget) => (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    setHover(target)
    onHover?.(target)
  }
  const leave = () => {
    setHover(null)
    onHover?.(null)
  }
  const press = (target: RoadMapTarget) => (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    if (target.kind === "place") onPlace?.(target.index)
    else onRoad?.(target.index)
  }

  const radius = size / 2
  const ringOuter = radius * S.ringGrow
  return (
    <>
      {roads.map(([from, to], index) => {
        const a = places[from]
        const b = places[to]
        if (!a || !b) return null
        const look = roadLook?.(index) ?? {}
        const { x, z, yaw, length } = edgePlace(a, b)
        const owned = look.color !== undefined
        const width = owned ? line * S.ownedGrow : line
        const pressable = roadPressable(index)
        const hovered = hover?.kind === "road" && hover.index === index
        const listed = choosableRoads?.has(index) === true
        const target: RoadMapTarget = { kind: "road", index }
        return (
          <group key={`road-${index}`} position={[x, 0, z]} rotation-y={yaw}>
            {look.hidden !== true && (
              <mesh position-y={ROAD_HEIGHT} rotation-x={-Math.PI / 2} scale={[length, width, 1]} renderOrder={3} raycast={none}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial color={look.color ?? color} transparent opacity={owned ? 1 : S.faint} depthWrite={false} toneMapped={false} />
              </mesh>
            )}
            {(listed || (hovered && pressable)) && (
              <mesh position-y={HALO_HEIGHT} rotation-x={-Math.PI / 2} scale={[length * 0.86, Math.max(width * S.ownedGrow * 1.5, 0.22), 1]} renderOrder={5} material={hovered ? held : pulsing} raycast={none}>
                <planeGeometry args={[1, 1]} />
              </mesh>
            )}
            {pressable && (
              <mesh position-y={HALO_HEIGHT} rotation-x={-Math.PI / 2} scale={[Math.max(0.01, length - size * 0.9), Math.max(S.minHit, width * S.hitGrow), 1]} renderOrder={5} onPointerOver={enter(target)} onPointerOut={leave} onClick={press(target)}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
            )}
          </group>
        )
      })}
      {places.map((place, index) => {
        const look = placeLook?.(index) ?? {}
        const pressable = placePressable(index)
        const hovered = hover?.kind === "place" && hover.index === index
        const listed = choosablePlaces?.has(index) === true
        const target: RoadMapTarget = { kind: "place", index }
        return (
          <group key={`place-${index}`} position={[place.x, 0, place.z]}>
            {look.hidden !== true && (
              <mesh position-y={PLACE_HEIGHT} rotation-x={-Math.PI / 2} scale={hovered && pressable ? 1.15 : 1} renderOrder={4} raycast={none}>
                <circleGeometry args={[radius, 28]} />
                <meshBasicMaterial color={look.color ?? color} transparent opacity={look.color ? 1 : 0.92} depthWrite={false} toneMapped={false} />
              </mesh>
            )}
            {look.hidden !== true && look.label ? <TableText text={look.label} style={{ color: look.ink ?? ink }} height={size * 0.55} position={[0, LABEL_HEIGHT, 0]} /> : null}
            {(listed || (hovered && pressable)) && (
              <mesh position-y={HALO_HEIGHT} rotation-x={-Math.PI / 2} renderOrder={5} material={hovered ? held : pulsing} raycast={none}>
                <ringGeometry args={[ringOuter - S.ringWidth, ringOuter, 40]} />
              </mesh>
            )}
            {pressable && (
              <mesh position-y={HALO_HEIGHT} rotation-x={-Math.PI / 2} renderOrder={5} onPointerOver={enter(target)} onPointerOut={leave} onClick={press(target)}>
                <circleGeometry args={[Math.max(radius, ringOuter * 0.9), 28]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
            )}
          </group>
        )
      })}
    </>
  )
}
