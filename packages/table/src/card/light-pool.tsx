"use client"

import { usePrefersReducedMotion } from "@pbgo/core/lib/use-motion"
import { useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useEffect, useRef } from "react"
import { AdditiveBlending, Color, type Mesh, type MeshBasicMaterial } from "three"
import { type CardSize, cornerRadius } from "./geometry"
import { type BloomKey, CARD_STATE_SETTINGS, type CardState, stateLook } from "./states"
import { useCardBlooms } from "./theme"
import { haloTexture } from "./textures"

// A colour is parsed only when it differs from the last one set on the material
const tints = new WeakMap<Color, string>()
function tint(color: Color, value: string) {
  if (tints.get(color) === value) return
  tints.set(color, value)
  color.set(value)
}

/**
 * The pool of light of a card in a state, with no card in it: for a place where a card will lie, or an area that has none yet and still can be chosen. It lies flat on the table, takes no pointer, and is lit as a card is: the same looks for each state, the same colours of the game's
 * `UI_THEME.card`, the same breath when it can be chosen, so that a place with no card and a place with one read alike. `state` is the state it is drawn in (the table has no pointer to raise it: the game says `hover` or `pressed`, as it does for a card whose zone the
 * pointer is over).
 */
export function LightPool({ size, state, position = [0, 0.012, 0], yaw = 0 }: { size: CardSize; state: CardState; position?: [number, number, number]; yaw?: number }) {
  const reduced = usePrefersReducedMotion()
  const blooms = useCardBlooms()
  const margin = Math.min(size.width, size.height) * CARD_STATE_SETTINGS.bloomSpread
  const texture = haloTexture(size.width, size.height, margin, cornerRadius(size))
  const mesh = useRef<Mesh>(null)
  const material = useRef<MeshBasicMaterial>(null)
  const latest = useRef({ state, blooms })
  const lived = useRef({ bloom: 0, key: "interactive" as BloomKey })
  useEffect(() => {
    latest.current = { state, blooms }
  })
  useFrame(({ clock }, dt) => {
    const m = material.current
    if (!m || !mesh.current) return
    const SS = CARD_STATE_SETTINGS
    const look = stateLook(latest.current.state, SS)
    const now = lived.current
    if (look.theme) now.key = look.theme
    if (reduced) now.bloom = look.bloom
    else easing.damp(now, "bloom", look.bloom, SS.bloomSettle, dt)
    const light = latest.current.blooms[now.key]
    const pulse = latest.current.state === "interactive" && !reduced ? Math.sin(clock.elapsedTime * SS.bloomSpeed) * SS.bloomPulse : 0
    m.opacity = Math.min(1, now.bloom * SS.bloomOpacity * light.strength * (1 + pulse))
    tint(m.color, light.color)
    mesh.current.visible = m.opacity > 0.01
  })
  return (
    <mesh ref={mesh} position={position} rotation={[-Math.PI / 2, 0, yaw]} raycast={() => null} visible={false}>
      <planeGeometry args={[size.width + 2 * margin, size.height + 2 * margin]} />
      <meshBasicMaterial ref={material} map={texture} transparent opacity={0} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
    </mesh>
  )
}
