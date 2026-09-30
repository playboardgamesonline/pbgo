"use client"

import type { VisibleCard, Mission, PlayerView } from "@courtisans/engine"
import { useCursor } from "@react-three/drei"
import { button, useControls } from "leva"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { easing } from "maath"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import {
  CanvasTexture,
  Color,
  Euler,
  type Group,
  type Mesh,
  MeshBasicMaterial,
  type PerspectiveCamera,
  Quaternion,
  type Texture,
  Vector2,
  Vector3,
} from "three"
import { useCourtisans } from "../game/context"
import { playSound } from "@pbgo/core/lib/sound"
import { useInteraction } from "../game/interaction"
import { Aura, AURA_FIELDS, WINNER_AURA_SETTINGS, ZONE_AURA_SETTINGS } from "./aura"
import { CardSettingsPanel } from "./card-settings"
import { GamePhoto } from "./photo"
import { CrownMark } from "./crown"
import type { EndingState } from "./ending"
import { Counters, MissionSign, MatLine, MatLines, PilePoints, ENDING_SETTINGS, EndingSettings, FamilyResolution, useWinnerCenters } from "./ending3d"
import { useSettings, useSettingsVersion } from "./settings"
import { patternTexture } from "./patterns"
import { roundValue, copyButton, debugTab, COPY_ORDER } from "@pbgo/core/components/game/debug-tabs"
import { Card3D, CARD_SETTINGS, cardGeometry, edgeGeometry } from "./card3d"
import { type TextStyle, TableText } from "./table-text"
import {
  CARD_H,
  CARD_W,
  DOMAIN_SCALE,
  FACE_DOWN,
  FACE_UP,
  MISSION_H,
  MISSION_W,
  DRAW_PILE,
  MISSION_PILE,
  missionPilePose,
  LAYOUT_SETTINGS,
  type Pose,
  MAT_W,
  MAT_D,
  columnX,
  type Column as Column_,
  type DomainZone,
  columnOf,
  groupKey,
  arrangeDomain,
  deckTopPose,
  lean,
  tablePose,
  type Seat,
  seats,
  missionRestPose,
} from "./layout"
import { type Textures, useTextures } from "./textures"

type Placed = { card: VisibleCard; pose: Pose; playerId?: string }

function arrange(view: PlayerView, places: Map<string, Seat>, unfolded: string | null = null, ending: EndingState | null = null) {
  const map = new Map<string, Placed>()
  const ranks = new Map<string, number>()
  const zones = new Map<string, DomainZone>()
  for (const { card, level } of view.table) {
    const spy = !!ending && card.role === "spy"
    const col = spy && ending.tableSpies !== "sort" ? "queen" : columnOf(card)
    const key = `${col}:${level}`
    const rank = ranks.get(key) ?? 0
    ranks.set(key, rank + 1)
    const pose = tablePose(col, level, rank, card.id)
    if (spy && ending.tableSpies === "cache") pose.quaternion.copy(lean(card.id)).multiply(FACE_DOWN)
    map.set(card.id, { card, pose })
  }
  for (const j of view.players) {
    const seat = places.get(j.id)
    if (!seat) continue
    const hidden = ending && !ending.domains ? new Set(j.domain.filter((c) => c.role === "spy").map((c) => c.id)) : null
    const liftedPile = ending && ending.pile > 0 && !ending.missions ? ending.pile - 1 : null
    const { poses, zone } = arrangeDomain(
      seat,
      j.domain,
      unfolded?.startsWith(`${j.id}:`) ? unfolded.slice(j.id.length + 1) : null,
      hidden,
      liftedPile,
    )
    zones.set(j.id, zone)
    for (const card of j.domain) map.set(card.id, { card, pose: poses.get(card.id)!, playerId: j.id })
  }
  return { map, ranks, zones }
}

const underTablePose = (zone: DomainZone): Pose => {
  const outside = new Vector3(zone.center.x, 0, zone.center.z).normalize()
  return {
    position: zone.center
      .clone()
      .addScaledVector(outside, zone.depth / 2 + 1.2)
      .setY(-1.6),
    quaternion: new Quaternion().setFromEuler(new Euler(0, zone.labelYaw, 0)).multiply(FACE_DOWN),
    scaleFactor: DOMAIN_SCALE * 0.8,
  }
}

const seatPose = (zone: DomainZone): Pose => ({
  position: new Vector3(zone.labelPos.x, 3.5, zone.labelPos.z),
  quaternion: new Quaternion().setFromEuler(new Euler(0, zone.labelYaw, 0)).multiply(FACE_DOWN),
  scaleFactor: DOMAIN_SCALE * 0.7,
})

type Transient = {
  id: string
  card: VisibleCard | null
  origin: Pose
  target: Pose
}

export const DEFAULT_CAMERA = { tilt: 40, yaw: 0, distance: 37.6, fov: 26.5, target: { x: 0, y: 0.6 } }

const RAD = Math.PI / 180
const Y_AXIS = new Vector3(0, 1, 0)
const EMPTY: string[] = []
const TARGET_TMP = new Vector3()

function CameraRig() {
  const { size } = useThree()
  const [setting, adjust] = useControls(
    "Camera",
    () => ({
      tilt: { value: DEFAULT_CAMERA.tilt, min: 0, max: 85, step: 0.5, label: "tilt °" },
      yaw: { value: DEFAULT_CAMERA.yaw, min: -180, max: 180, step: 1, label: "yaw °" },
      distance: { value: DEFAULT_CAMERA.distance, min: 8, max: 70, step: 0.1, label: "distance" },
      fov: { value: DEFAULT_CAMERA.fov, min: 10, max: 100, step: 0.5, label: "fov °" },
      target: { value: DEFAULT_CAMERA.target, step: 0.05, label: "target x / z" },
    }),
    { order: 0 },
    debugTab("SCENE"),
  )
  useControls(
    "Camera",
    {
      "Copy values": { ...button((get) => {
        const values = {
          tilt: get("Camera.inclinaison"),
          yaw: get("Camera.lacet"),
          distance: get("Camera.distance"),
          fov: get("Camera.fov"),
          target: get("Camera.cible"),
        }
        navigator.clipboard?.writeText(JSON.stringify({ Camera: values }, roundValue, 2)).catch(() => null)
        console.info("Camera", values)
      }), order: COPY_ORDER },
      Reset: { ...button(() => adjust(DEFAULT_CAMERA)), order: COPY_ORDER + 1 },
    },
    { order: 0 },
    debugTab("SCENE"),
  )

  useFrame((makeState) => {
    const cam = makeState.camera as PerspectiveCamera
    const k = Math.max(1, 1.6 / (size.width / size.height))
    const r = setting.distance * k
    const incl = setting.tilt * RAD
    const yaw = setting.yaw * RAD
    const target = TARGET_TMP.set(setting.target.x, 0, setting.target.y)
    cam.up.set(0, 1, 0)
    cam.position.set(
      target.x + r * Math.sin(incl) * Math.sin(yaw),
      Math.max(0.5, r * Math.cos(incl)),
      target.z + r * Math.sin(incl) * Math.cos(yaw),
    )
    if (incl < 0.001) cam.up.set(-Math.sin(yaw), 0, -Math.cos(yaw))
    cam.lookAt(target)
    if (cam.fov !== setting.fov) {
      cam.fov = setting.fov
      cam.updateProjectionMatrix()
    }
  })
  return null
}

function useFrameTexture(create: () => CanvasTexture) {
  const [texture] = useState(create)
  return texture
}

function vignetteTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 512
  const g = c.getContext("2d")!
  const grad = g.createRadialGradient(256, 256, 40, 256, 256, 256)
  grad.addColorStop(0, "#1d5a60")
  grad.addColorStop(0.6, "#12424a")
  grad.addColorStop(1, "#0a2a30")
  g.fillStyle = grad
  g.fillRect(0, 0, 512, 512)
  return new CanvasTexture(c)
}

const MAT_GLSL = /* glsl */ `
uniform vec2 uSize;
uniform float uUnroll;
uniform float uDesat;
uniform sampler2D uCloth;
uniform float uWithCloth;
uniform float uScale;
uniform float uMode;
uniform float uStrength;
vec3 melangeTapis(vec3 a, vec3 b) {
  if (uMode < 0.5) return a * b;
  if (uMode < 1.5) return 1.0 - (1.0 - a) * (1.0 - b);
  if (uMode < 2.5) return mix(2.0 * a * b, 1.0 - 2.0 * (1.0 - a) * (1.0 - b), step(0.5, a));
  return (1.0 - 2.0 * b) * a * a + 2.0 * b * a;
}
`

const MAT_FRAGMENT = /* glsl */ `
#include <map_fragment>
{
  if (vMapUv.x > uUnroll) discard;
  float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(l), uDesat);
  if (uWithCloth > 0.5) {
    vec3 a = pow(max(diffuseColor.rgb, 0.0), vec3(1.0 / 2.2));
    vec3 b = pow(texture2D(uCloth, vMapUv * uSize * uScale).rgb, vec3(1.0 / 2.2));
    diffuseColor.rgb = pow(mix(a, clamp(melangeTapis(a, b), 0.0, 1.0), uStrength), vec3(2.2));
  }
}
`

export const BLEND_MODES = { multiply: 0, screen: 1, overlay: 2, "soft light": 3 } as const

function Table({ tex, flow, matDuration }: { tex: Textures; flow: boolean; matDuration: number }) {
  const vignette = useFrameTexture(vignetteTexture)
  const texPattern = useMemo(() => patternTexture("diamonds"), [])
  const { opacity, desaturation, blend, strength, scaleFactor, thickness } = useControls(
    "Mat",
    {
      opacity: { value: 0.12, min: 0, max: 1, step: 0.01, label: "background pattern opacity" },
      desaturation: { value: 0.06, min: 0, max: 1, step: 0.01, label: "desaturation" },
      blend: { value: 3, options: BLEND_MODES, label: "blend mode" },
      strength: { value: 0.8, min: 0, max: 1, step: 0.01, label: "texture strength" },
      scaleFactor: { value: 0.5, min: 0.1, max: 6, step: 0.05, label: "tiles / unit" },
      thickness: { value: MAT_THICKNESS, min: 0.001, max: 0.3, step: 0.001, label: "thickness" },
      ...copyButton("SCENE", "Mat"),
    },
    { collapsed: true, order: 8 },
    debugTab("SCENE"),
  )
  const top = useMemo(() => cardGeometry(MAT_W, MAT_D, 0.07), [])
  const rim = useMemo(() => {
    const geo = edgeGeometry(MAT_W, MAT_D, thickness, 0.07).clone()
    const pos = geo.attributes.position!
    const uv = geo.attributes.uv!
    for (let i = 0; i < pos.count; i++)
      uv.setXY(i, Math.min(0.998, Math.max(0.002, pos.getX(i) / MAT_W + 0.5)), Math.min(0.998, Math.max(0.002, pos.getY(i) / MAT_D + 0.5)))
    uv.needsUpdate = true
    return geo
  }, [thickness])
  useEffect(() => () => rim.dispose(), [rim])
  const material = useMemo(() => {
    const uniformValues = {
      uSize: { value: new Vector2(MAT_W, MAT_D) },
      uUnroll: { value: 1 },
      uDesat: { value: 0.18 },
      uCloth: { value: null as Texture | null },
      uWithCloth: { value: 0 },
      uScale: { value: 0.5 },
      uMode: { value: 3 },
      uStrength: { value: 0.7 },
    }
    const m = new MeshBasicMaterial({ map: tex.mat, toneMapped: false })
    m.userData.uniformValues = uniformValues
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniformValues)
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${MAT_GLSL}`)
        .replace("#include <map_fragment>", MAT_FRAGMENT)
    }
    return m
  }, [tex.mat])
  const topRef = useRef<Mesh>(null)
  const start = useRef<number | null>(null)
  const roller = useRef<Mesh>(null)
  useFrame(({ clock }) => {
    const uniformValues = (topRef.current?.material as MeshBasicMaterial | undefined)?.userData.uniformValues
    if (!uniformValues) return
    uniformValues.uDesat.value = desaturation
    uniformValues.uCloth.value = tex.cloth
    uniformValues.uWithCloth.value = tex.cloth ? 1 : 0
    uniformValues.uMode.value = blend
    uniformValues.uStrength.value = strength
    uniformValues.uScale.value = scaleFactor
    let d = 1
    if (flow) {
      if (start.current === null) start.current = clock.elapsedTime
      const t = Math.min(1, Math.max(0, (clock.elapsedTime - start.current - 0.15) / matDuration))
      d = 1 - (1 - t) ** 3
    } else start.current = null
    uniformValues.uUnroll.value = d
    const r = roller.current
    if (r) {
      r.visible = d < 0.999
      const radius = 0.06 + 0.26 * (1 - d)
      r.position.set(-MAT_W / 2 + d * MAT_W, radius + 0.02, 0)
      r.scale.set(radius, 1, radius)
    }
  })
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02}>
        <planeGeometry args={[80, 60]} />
        <meshBasicMaterial map={vignette} toneMapped={false} />
      </mesh>
      {texPattern && (
        <mesh rotation-x={-Math.PI / 2} position-y={-0.015} raycast={() => null}>
          <planeGeometry args={[80, 60]} />
          <meshBasicMaterial map={texPattern} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      <mesh geometry={rim} rotation-x={-Math.PI / 2} material={[CACHE, material]} />
      <mesh ref={topRef} geometry={top} rotation-x={-Math.PI / 2} position-y={thickness + 0.001} material={material} />
      <mesh ref={roller} rotation-x={Math.PI / 2} visible={false} raycast={() => null}>
        <cylinderGeometry args={[1, 1, MAT_D, 32]} />
        <meshStandardMaterial color="#1f5358" roughness={0.9} />
      </mesh>
    </group>
  )
}

const MAT_THICKNESS = 0.018
const CACHE = new MeshBasicMaterial({ visible: false })

const FADE = { uFadeBottom: { value: 0.8 }, uFadeTop: { value: 4 } }

function withFade(m: MeshBasicMaterial) {
  if (m.userData.fade) return
  m.userData.fade = true
  const previous = m.onBeforeCompile
  m.onBeforeCompile = (shader, renderer) => {
    previous.call(m, shader, renderer)
    Object.assign(shader.uniforms, FADE)
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vHauteurFondu;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvHauteurFondu = (modelMatrix * vec4(transformed, 1.0)).y;")
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vHauteurFondu;\nuniform float uFadeBottom;\nuniform float uFadeTop;")
      .replace(
        "#include <dithering_fragment>",
        "#include <dithering_fragment>\ngl_FragColor.a *= 1.0 - smoothstep(uFadeBottom, uFadeTop, vHauteurFondu);",
      )
  }
  const key = m.customProgramCacheKey.bind(m)
  m.customProgramCacheKey = () => `${key()}:fondu`
  m.needsUpdate = true
}

function Appear({
  active,
  delay,
  duration,
  elevation,
  mask = false,
  children,
}: {
  active: boolean
  delay: number
  duration: number
  elevation: number
  mask?: boolean
  children: React.ReactNode
}) {
  const ref = useRef<Group>(null)
  const start = useRef<number | null>(null)
  const done = useRef(true)
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    let u = 1
    if (active) {
      if (start.current === null) start.current = clock.elapsedTime
      u = Math.min(1, Math.max(0, (clock.elapsedTime - start.current - delay) / duration))
    } else start.current = null
    const e = 1 - (1 - u) ** 3
    g.position.y = elevation * (1 - e)
    g.visible = !active || clock.elapsedTime - (start.current ?? 0) >= delay || u > 0
    if (u >= 1 && done.current) return
    done.current = u >= 1
    g.traverse((o) => {
      const m = (o as Mesh).material as MeshBasicMaterial | undefined
      if (!m || Array.isArray(m)) return
      if (m.userData.transparentOrigine === undefined) {
        m.userData.transparentOrigine = m.transparent
        m.userData.opaciteOrigine = m.opacity
      }
      m.transparent = u < 1 || m.userData.transparentOrigine
      if (mask) {
        if (u < 1) withFade(m)
      } else m.opacity = m.userData.opaciteOrigine * e
    })
  })
  return (
    <group ref={ref} userData={{ hideInPhoto: true }}>
      {children}
    </group>
  )
}

function FollowCamera({ children }: { children: React.ReactNode }) {
  const ref = useRef<Group>(null)
  const { camera } = useThree()
  useFrame(() => {
    const g = ref.current
    if (!g) return
    g.position.copy(camera.position)
    g.quaternion.copy(camera.quaternion)
  }, -1)
  return <group ref={ref}>{children}</group>
}

const EASINGS = {
  linear: (u: number) => u,
  "ease in": (u: number) => u * u * u,
  "ease out": (u: number) => 1 - (1 - u) ** 3,
  "ease in-out": (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2),
}
type DrawPileSettings = {
  delay: number
  duration: number
  drop: number
  elevation: number
  easing: keyof typeof EASINGS
  fadeBottom: number
  fadeTop: number
}

const deckEnd = (r: DrawPileSettings) => r.delay + r.duration

function DrawPile({ count, active, settings: r }: { count: number; active: boolean; settings: DrawPileSettings }) {
  const cardThickness = CARD_W * CARD_SETTINGS.thickness
  const geo = useMemo(() => edgeGeometry(CARD_W, CARD_H, cardThickness), [cardThickness])
  const n = Math.min(count, 60)
  const cards = useRef<(Group | null)[]>([])
  const start = useRef<number | null>(null)
  const animated = useRef(false)
  useFrame(({ clock }) => {
    FADE.uFadeBottom.value = r.fadeBottom
    FADE.uFadeTop.value = r.fadeTop
    if (active && start.current === null) start.current = clock.elapsedTime
    if (!active) start.current = null
    const t = start.current === null ? Infinity : clock.elapsedTime - start.current
    const total = Math.max(1, n - 1)
    let pending = false
    cards.current.forEach((g, i) => {
      if (!g) return
      const base = 0.03 + (i + 1) * LAYOUT_SETTINGS.deckSpacing
      const arrival = r.delay + EASINGS[r.easing](i / total) * r.duration
      const u = Math.min(1, Math.max(0, (t - (arrival - r.drop)) / r.drop))
      if (u < 1) pending = true
      g.visible = u > 0
      g.position.y = base + r.elevation * (1 - u * u)
    })
    if (pending !== animated.current) {
      animated.current = pending
      cards.current.forEach((g) =>
        g?.traverse((o) => {
          const mats = (o as Mesh).material
          if (!mats) return
          for (const m of Array.isArray(mats) ? mats : [mats]) {
            withFade(m as MeshBasicMaterial)
            m.transparent = pending
          }
        }),
      )
    }
  })
  return (
    <group position={[DRAW_PILE.x, 0, DRAW_PILE.z]}>
      {Array.from({ length: Math.max(0, n - 1) }, (_, i) => (
        <group
          key={i}
          ref={(g) => {
            cards.current[i] = g
          }}
          position-y={0.03 + (i + 1) * LAYOUT_SETTINGS.deckSpacing}
          quaternion={lean(`pioche${i + 1}`, 0.04)}
        >
          <mesh geometry={geo} rotation-x={-Math.PI / 2} position-y={-cardThickness / 2} raycast={() => null}>
            <meshBasicMaterial attach="material-0" color="#123c42" toneMapped={false} />
            <meshBasicMaterial attach="material-1" color={i % 2 ? "#d9cba6" : "#cdbf98"} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Veil({ active, opacity, fade = 0.2 }: { active: boolean; opacity: number; fade?: number }) {
  const ref = useRef<Mesh>(null)
  const { camera } = useThree()
  useFrame((_, dt) => {
    if (!ref.current) return
    ref.current.position.copy(camera.localToWorld(new Vector3(0, 0, -5)))
    ref.current.quaternion.copy(camera.quaternion)
    const m = ref.current.material as MeshBasicMaterial
    easing.damp(m, "opacity", active ? opacity : 0, active ? fade : 0.2, dt)
    ref.current.visible = m.opacity > 0.01
  })
  return (
    <mesh ref={ref} renderOrder={10} userData={{ hideInPhoto: true }}>
      <planeGeometry args={[40, 40]} />
      <meshBasicMaterial color="#020b0d" transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

export const ZONE_SETTINGS = {
  restOpacity: 0.05,
  playableOpacity: 0.12,
  hoverOpacity: 0.22,
  playableAura: 0.55,
  hoverAura: 1,
  rounding: 0.35,
  nicknameSize: 0.62,
  nicknameOffset: 0.45,
}

function ZoneSettings() {
  useSettings(
    "Player Zone",
    ZONE_SETTINGS,
    {
      restOpacity: ["idle opacity", 0, 1, 0.01],
      playableOpacity: ["playable opacity", 0, 1, 0.01],
      hoverOpacity: ["hover opacity", 0, 1, 0.01],
      playableAura: ["playable aura", 0, 2, 0.01],
      hoverAura: ["hover aura", 0, 2, 0.01],
      rounding: ["corner radius", 0, 1.5, 0.01],
      nicknameSize: ["name size", 0.2, 2, 0.01],
      nicknameOffset: ["name offset", -2, 2, 0.01],
    },
    { order: 6 },
  )
  useSettings("Player Zone", ZONE_AURA_SETTINGS, AURA_FIELDS as never, { order: 6 })
  return null
}

function DomainBackground({ zone, playable, hover, color }: { zone: DomainZone; playable: boolean; hover: boolean; color: string }) {
  const bright = useMemo(() => `#${new Color(color).lerp(new Color("#ffffff"), 0.65).getHexString()}`, [color])
  const ref = useRef<MeshBasicMaterial>(null)
  const rounding = ZONE_SETTINGS.rounding
  const geo = useMemo(() => cardGeometry(zone.width, zone.depth, rounding), [zone.width, zone.depth, rounding])
  useFrame((_, dt) => {
    const m = ref.current
    if (!m) return
    easing.damp(m, "opacity", playable ? (hover ? ZONE_SETTINGS.hoverOpacity : ZONE_SETTINGS.playableOpacity) : ZONE_SETTINGS.restOpacity, 0.15, dt)
    easing.dampC(m.color, playable ? color : "#ffffff", 0.2, dt)
  })
  return (
    <>
      <mesh geometry={geo} position={zone.center} rotation={[-Math.PI / 2, 0, zone.yaw]} raycast={() => null}>
        <meshBasicMaterial ref={ref} color="#ffffff" transparent opacity={0.05} depthWrite={false} toneMapped={false} />
      </mesh>
      <Aura
        width={zone.width}
        depth={zone.depth}
        position={[zone.center.x, 0.014, zone.center.z]}
        yaw={zone.yaw}
        strength={() => (playable ? (hover ? ZONE_SETTINGS.hoverAura : ZONE_SETTINGS.playableAura) : 0)}
        settings={ZONE_AURA_SETTINGS}
        color={color}
        bright={bright}
      />
    </>
  )
}

function Badge({
  zone,
  text,
  style,
  onClick,
  onHover,
}: {
  zone: DomainZone
  text: string
  style: TextStyle
  onClick?: () => void
  onHover?: (s: boolean) => void
}) {
  return (
    <group position={zone.labelPos} rotation-y={zone.labelYaw}>
      <TableText
        text={text}
        style={style}
        elevation={ZONE_SETTINGS.nicknameSize}
        position={[0, 0, -ZONE_SETTINGS.nicknameOffset]}
        onClick={onClick}
        onHover={onHover}
      />
    </group>
  )
}

function ClickableZone({ zone, onClick, onHover }: { zone: DomainZone; onClick: () => void; onHover: (s: boolean) => void }) {
  const [hover, setHover] = useState(false)
  useCursor(hover)
  return (
    <mesh
      position={[zone.center.x, 0.016, zone.center.z]}
      rotation={[-Math.PI / 2, 0, zone.yaw]}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHover(true)
        onHover(true)
      }}
      onPointerOut={() => {
        setHover(false)
        onHover(false)
      }}
    >
      <planeGeometry args={[zone.width, zone.depth + 0.8]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

function Target({ column, level, onClick }: { column: Column_; level: "up" | "down"; onClick: () => void }) {
  return <MatLine x={columnX(column)} light={level === "up"} onClick={onClick} />
}

function Ephemeral({ item, tex, onEnd }: { item: Transient; tex: Textures; onEnd: () => void }) {
  useEffect(() => {
    const t = setTimeout(onEnd, 3000 + (item.origin.delay ?? 0) * 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <Card3D
      target={item.target}
      origin={item.origin}
      front={item.card ? tex.face(item.card) : tex.back}
      backFace={tex.back}
      width={CARD_W}
      elevation={CARD_H}
      speed={0.12}
      onArrive={onEnd}
    />
  )
}

const HAND_DISTANCE = 6
const INK = { color: "rgba(4,32,36,0.45)" }
const SPACING = "18px"
const QUAT_TMP = new Quaternion()
const QUAT_GROUP = new Quaternion()
const QUAT_LOCAL = new Quaternion()
const EULER_TMP = new Euler()

export type OpeningStep = "unroll" | "deal" | "missions" | null
export type OpeningSettings = { matDuration: number; dealStep: number }

function World({
  openingStep,
  missionFocus,
  onMission,
  onReady,
  ending,
  settings,
}: {
  openingStep: OpeningStep
  missionFocus: string | null
  onMission: (id: string) => void
  onReady: () => void
  ending: EndingState | null
  settings: OpeningSettings
}) {
  useEffect(() => onReady(), [onReady])
  const { view, catalog, nickname, color } = useCourtisans()
  const it = useInteraction()
  const missions = useMemo(() => view.me?.missions ?? [], [view.me?.missions])
  const allMissions = useMemo(
    () => [...missions, ...view.players.flatMap((j) => (j.id === view.me?.id ? [] : (j.missions ?? [])))],
    [missions, view.players, view.me?.id],
  )
  const tex = useTextures(catalog, allMissions)
  const places = useMemo(() => seats(view), [view])
  const [unfolded, setUnfolded] = useState<string | null>(null)
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoverGroup = (key: string, active: boolean) => {
    if (closing.current) clearTimeout(closing.current)
    if (active) setUnfolded(key)
    else closing.current = setTimeout(() => setUnfolded((d) => (d === key ? null : d)), 180)
  }
  const settingsVersion = useSettingsVersion()
  const { map: board, zones } = useMemo(
    () => arrange(view, places, it.assassination ? unfolded : null, ending),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, places, unfolded, ending, it.assassination, settingsVersion],
  )
  const hand = view.me?.hand ?? []
  const meId = view.me?.id
  const myZone = meId ? zones.get(meId) : undefined
  // poses au repos des missions des autres joueurs (dos seulement) : mises en cache pour ne pas relancer l'animation à chaque rendu
  const restPoses = useMemo(() => new Map<string, Pose>(), [zones])
  const restPose = (zone: DomainZone, id: string, k: number) => {
    const key = `${id}:${k}`
    let p = restPoses.get(key)
    // eslint-disable-next-line react-hooks/immutability
    if (!p) restPoses.set(key, (p = missionRestPose(zone, k, id)))
    return p
  }

  const [prevView, setPrevView] = useState(view)
  const [origins, setOrigins] = useState<Map<string, Pose>>(new Map())
  const [transients, setTransients] = useState<Transient[]>([])

  const [cameraPoses] = useState(() => new Map<string, Pose>())

  if (prevView !== view) {
    const newOnes = new Map<string, Pose>()
    const added: Transient[] = []
    if (view.log.length >= prevView.log.length) {
      const before = arrange(prevView, seats(prevView)).map
      view.log.slice(prevView.log.length).forEach((e, n) => {
        if (e.type === "cardPlayed" && e.playerId !== meId) {
          const zone = zones.get(e.playerId)
          if (zone) newOnes.set(e.card.id, seatPose(zone))
        }
        if (e.type === "cardPlayed" && e.playerId === meId) {
          const p = cameraPoses.get(e.card.id)
          if (p) newOnes.set(e.card.id, { position: p.position.clone(), quaternion: p.quaternion.clone(), scaleFactor: p.scaleFactor })
        }
        if (e.type === "cardEliminated") {
          const p = before.get(e.card.id)
          if (p) {
            const target = {
              position: p.pose.position.clone().add(new Vector3(0, 6, -2)),
              quaternion: p.pose.quaternion.clone(),
              scaleFactor: 0.2,
            }
            added.push({
              id: `x-${prevView.log.length + n}`,
              card: p.card,
              origin: p.pose,
              target,
            })
          }
        }
        if (e.type === "draw" && e.playerId !== meId) {
          const zone = zones.get(e.playerId)
          if (zone)
            for (let i = 0; i < e.count; i++)
              added.push({
                id: `p-${prevView.log.length + n}-${i}`,
                card: null,
                origin: { ...deckTopPose(prevView.deckCount - i), delay: 0.35 + i * 0.28 },
                target: underTablePose(zone),
              })
        }
      })
      const beforeHand = new Set(prevView.me?.hand.map((c) => c.id))
      let rank = 0
      for (const c of hand)
        if (!beforeHand.has(c.id)) newOnes.set(c.id, { ...deckTopPose(prevView.deckCount - rank), delay: 0.35 + rank++ * 0.28 })
    }
    setOrigins(newOnes)
    if (added.length) setTransients((t) => [...t, ...added])
    setPrevView(view)
  }

  const [prevStep, setPrevStep] = useState<OpeningStep>(openingStep)
  const flow = openingStep === "unroll"
  const [deal, setDeal] = useState<Map<string, Pose>>(new Map())
  const [missionOrigins, setMissionOrigins] = useState<Map<string, Pose>>(new Map())
  const cameraOuverture = useThree((s) => s.camera)
  if (prevStep !== openingStep) {
    setPrevStep(openingStep)
    if (openingStep === "deal") {
      const n = view.players.length
      const total = n * 3
      const dist = new Map<string, Pose>()
      const added: Transient[] = []
      for (let r = 0; r < 3; r++)
        view.players.forEach((j, idx) => {
          const k = r * n + idx
          const origin = { ...deckTopPose(view.deckCount + total - k), delay: 0.1 + k * settings.dealStep }
          playSound("slide", { volume: 0.45, delay: origin.delay + 0.1 })
          if (j.id === meId) {
            const card = hand[r]
            if (card) dist.set(card.id, origin)
          } else {
            const zone = zones.get(j.id)
            if (zone) added.push({ id: `d-${j.id}-${r}`, card: null, origin, target: underTablePose(zone) })
          }
        })
      setDeal(dist)
      if (added.length) setTransients((t) => [...t, ...added])
    }
    if (openingStep === "missions") {
      cameraOuverture.updateMatrixWorld()
      const inverse = cameraOuverture.quaternion.clone().invert()
      setMissionOrigins(
        new Map(
          missions.map((m, i) => {
            const from = missionPilePose(MISSION_PILE.size + i)
            return [
              m.id,
              {
                position: cameraOuverture.worldToLocal(from.position.clone()),
                quaternion: inverse.clone().multiply(from.quaternion),
                scaleFactor: from.scaleFactor,
                delay: 0.35 + i * 0.3,
              },
            ]
          }),
        ),
      )
    }
  }
  const intro = openingStep === "missions"
  const visibleHand = openingStep !== "unroll"
  const visibleMissions = openingStep === "missions" || openingStep === null

  const { camera } = useThree()
  const missionSettings = useControls(
    "Missions",
    {
      distance: { value: 4.4, min: 2, max: 10, step: 0.05, label: "camera distance" },
      position: { value: { x: 0, y: 0.32 }, step: 0.01, label: "group position" },
      rotation: { value: { x: 0, y: 0, z: 0 }, step: 0.01, label: "group rotation" },
      scaleFactor: { value: 1.4, min: 0.5, max: 2.5, step: 0.01, label: "scale" },
      gap: { value: 0.3, min: -1, max: 3, step: 0.01, label: "gap" },
      angles: { value: { y: 0.06, z: 0.01 }, step: 0.01, label: "card angles" },
      card1: { value: { x: 0, y: 0 }, step: 0.01, label: "card 1 offset" },
      card2: { value: { x: 0, y: 0 }, step: 0.01, label: "card 2 offset" },
      backOffset: { value: 0, min: 0, max: 1, step: 0.01, label: "outer depth" },
      mouse: { value: 0.1, min: 0, max: 1, step: 0.01, label: "mouse tilt" },
      veil: { value: 0.24, min: 0, max: 1, step: 0.01, label: "overlay opacity" },
      focusVeil: { value: 0.24, min: 0, max: 1, step: 0.01, label: "focus overlay opacity" },
      veilFade: { value: 0.8, min: 0.05, max: 2, step: 0.05, label: "overlay fade" },
      ...copyButton("SCENE", "Missions"),
    },
    { collapsed: true, order: 4 },
    debugTab("SCENE"),
  )
  const drawPileSettings = useControls(
    "Draw Pile",
    {
      delay: { value: 0.15, min: 0, max: 5, step: 0.05, label: "delay (s)" },
      duration: { value: 1.4, min: 0.1, max: 6, step: 0.05, label: "total duration (s)" },
      drop: { value: 0.35, min: 0.05, max: 2, step: 0.01, label: "single card fall (s)" },
      elevation: { value: 3, min: 0.5, max: 10, step: 0.1, label: "fall height" },
      easing: { value: "ease out" as keyof typeof EASINGS, options: Object.keys(EASINGS) as (keyof typeof EASINGS)[], label: "global easing" },
      fadeBottom: { value: 0.8, min: 0, max: 5, step: 0.05, label: "fade: opaque below" },
      fadeTop: { value: 4, min: 0.5, max: 10, step: 0.05, label: "fade: transparent above" },
      counterDelay: { value: 0.1, min: 0, max: 3, step: 0.05, label: "counter delay (s)" },
      ...copyButton("SCENE", "Draw Pile"),
    },
    { collapsed: true, order: 3 },
    debugTab("SCENE"),
  )
  const handSettings = useControls(
    "Deck",
    {
      size: { value: 0.66, min: 0.2, max: 1.5, step: 0.01, label: "size" },
      step: { value: 0.9, min: 0.2, max: 1.5, step: 0.01, label: "spacing" },
      position: { value: { x: 0, y: 0.22 }, step: 0.005, label: "position" },
      rotation: { value: { x: -0.11, y: 0.15, z: -0.1 }, step: 0.01, label: "rotation" },
      fan: { value: 0.09, min: 0, max: 0.6, step: 0.005, label: "fan rotation" },
      curve: { value: 0.045, min: 0, max: 0.3, step: 0.005, label: "fan curve" },
      hoverLift: { value: 0.08, min: 0, max: 0.6, step: 0.005, label: "hover lift" },
      hoverScale: { value: 1, min: 0.8, max: 1.5, step: 0.01, label: "hover scale" },
      selectionLift: { value: 0.32, min: 0, max: 1, step: 0.01, label: "selected lift" },
      selectionScale: { value: 1.12, min: 0.8, max: 1.8, step: 0.01, label: "selected scale" },
      selectionAdvance: { value: 0.15, min: 0, max: 1, step: 0.01, label: "selected forward" },
      selectionRotation: { value: 0, min: -0.5, max: 0.5, step: 0.01, label: "selected rotation" },
      ...copyButton("SCENE", "Deck"),
    },
    { collapsed: true, order: 2 },
    debugTab("SCENE"),
  )
  const inGameMissionSettings = useControls(
    "Missions · In Game",
    {
      size: { value: 0.36, min: 0.1, max: 0.8, step: 0.01, label: "size" },
      position: { value: { x: 0, y: 0 }, step: 0.005, label: "position" },
      angles: { value: { card1: 0.08, card2: 0.01 }, step: 0.01, label: "angles" },
      card1: { value: { x: 0.1, y: 0.085 }, step: 0.005, label: "card 1 offset" },
      card2: { value: { x: 0.04, y: -0.07 }, step: 0.005, label: "card 2 offset" },
      hoverLift: { value: 0.02, min: 0, max: 0.5, step: 0.005, label: "hover lift" },
      hoverScale: { value: 1.01, min: 0.8, max: 1.5, step: 0.01, label: "hover scale" },
      hoverDuration: { value: 0.05, min: 0.01, max: 0.5, step: 0.01, label: "hover anim (s)" },
      returnDuration: { value: 0.12, min: 0.01, max: 0.8, step: 0.01, label: "return anim (s)" },
      defocusDuration: { value: 0.4, min: 0.01, max: 1.5, step: 0.01, label: "unfocus anim (s)" },
      focusReflection: { value: 0.06, min: 0, max: 1, step: 0.01, label: "focus reflection" },
      focusDistance: { value: 3.6, min: 2, max: 10, step: 0.05, label: "focus distance" },
      focusScale: { value: 1.4, min: 0.5, max: 3, step: 0.01, label: "focus scale" },
      focusMouse: { value: 0.16, min: 0, max: 1.5, step: 0.01, label: "focus mouse tilt" },
      ...copyButton("SCENE", "Missions · In Game"),
    },
    { collapsed: true, order: 5 },
    debugTab("SCENE"),
  )
  const [hover, setHover] = useState<string | null>(null)
  const [prevFocus, setPrevFocus] = useState(missionFocus)
  const [focusReturn, setFocusReturn] = useState<string | null>(null)
  if (prevFocus !== missionFocus) {
    setPrevFocus(missionFocus)
    if (prevFocus && !missionFocus) setFocusReturn(prevFocus)
  }
  if (focusReturn && hover === `mission:${focusReturn}`) setFocusReturn(null)
  const [hoverPlayer, setHoverPlayer] = useState<string | null>(null)
  useEffect(() => {
    if (hover) playSound("hover")
  }, [hover])
  useEffect(() => {
    if (hoverPlayer) playSound("hover", { volume: 0.7 })
  }, [hoverPlayer])
  useEffect(() => {
    if (unfolded) playSound("slide", { volume: 0.5 })
  }, [unfolded])
  const cameraPose = (id: string) => {
    let p = cameraPoses.get(id)
    if (!p) {
      p = { position: new Vector3(), quaternion: new Quaternion(), scaleFactor: 1 }
      cameraPoses.set(id, p)
    }
    return p
  }

  const selectionId = it.selection?.id
  useFrame(({ pointer }) => {
    const proj = camera.projectionMatrix.elements
    const h = HAND_DISTANCE / proj[5]
    const w = HAND_DISTANCE / proj[0]
    const rm = handSettings
    const elevation = h * rm.size
    const scaleFactor = elevation / CARD_H
    const width = CARD_W * scaleFactor
    const step = width * rm.step
    const n = hand.length
    const pivot = new Vector3(-w - width * 0.02 + width / 2 + ((n - 1) * step) / 2 + rm.position.x * w, -h + elevation * rm.position.y, -HAND_DISTANCE)
    const block = new Quaternion().setFromEuler(EULER_TMP.set(rm.rotation.x, rm.rotation.y, rm.rotation.z))
    hand.forEach((c, i) => {
      const t = i - (n - 1) / 2
      const chosen = c.id === selectionId
      const lifted = chosen ? elevation * rm.selectionLift : c.id === hover ? elevation * rm.hoverLift : 0
      const local = new Vector3(t * step, -Math.abs(t) * elevation * rm.curve + lifted, (chosen ? rm.selectionAdvance : 0) + i * 0.01)
        .applyQuaternion(block)
        .add(pivot)
      const p = cameraPose(c.id)
      p.position.copy(camera.localToWorld(local))
      p.quaternion
        .copy(camera.quaternion)
        .multiply(block)
        .multiply(QUAT_TMP.setFromEuler(EULER_TMP.set(0, 0, -t * rm.fan + (chosen ? rm.selectionRotation : 0))))
      p.scaleFactor = scaleFactor * (chosen ? rm.selectionScale : c.id === hover ? rm.hoverScale : 1)
    })
    const rj = inGameMissionSettings
    const mW = Math.min(w * rj.size, h * 0.8)
    const mH = (mW * MISSION_H) / MISSION_W
    missions.forEach((m, i) => {
      const p = cameraPose(`mission:${m.id}`)
      if (intro) {
        const r = missionSettings
        const k = (r.distance / 8) * (1 / (proj[5] * Math.tan((19 * Math.PI) / 180)))
        const dir = i === 0 ? 1 : -1
        const group = QUAT_GROUP.setFromEuler(EULER_TMP.set(r.rotation.x - pointer.y * r.mouse, r.rotation.y + pointer.x * r.mouse, r.rotation.z))
        const x = (i - 0.5) * (MISSION_W + r.gap) * k * r.scaleFactor
        const offset = i === 0 ? r.card1 : r.card2
        const dx = offset.x * k
        const dy = offset.y * k
        p.position.set(r.position.x * k, r.position.y * k, -r.distance).add(new Vector3(x + dx, dy, -Math.abs(x) * r.backOffset).applyQuaternion(group))
        p.quaternion.copy(group).multiply(QUAT_LOCAL.setFromEuler(EULER_TMP.set(0, dir * r.angles.y, -dir * r.angles.z)))
        p.scaleFactor = k * r.scaleFactor
      } else if (missionFocus === m.id) {
        const d = rj.focusDistance
        const k = (d / 8) * (1 / (proj[5] * Math.tan((19 * Math.PI) / 180)))
        p.position.set(0, -0.04 * k, -d)
        p.quaternion.setFromEuler(EULER_TMP.set(-pointer.y * rj.focusMouse, pointer.x * rj.focusMouse * 1.3, 0))
        p.scaleFactor = rj.focusScale * k
      } else if (myZone) {
        // posées face cachée sur la table, à droite du plateau ; convertie dans le repère de la caméra (les cartes suivent la caméra)
        const hovered = hover === `mission:${m.id}`
        const rest = missionRestPose(myZone, i, m.id)
        camera.updateMatrixWorld()
        if (hovered) rest.position.y += 0.18
        p.position.copy(camera.worldToLocal(rest.position))
        p.quaternion.copy(camera.quaternion).invert().multiply(rest.quaternion)
        p.scaleFactor = rest.scaleFactor * (hovered ? 1.08 : 1)
      } else {
        const hovered = hover === `mission:${m.id}`
        const jaw = i === 0 ? rj.angles.card1 : rj.angles.card2
        const arm = -mW * 0.44
        const pivotX = w - mW * 0.03 + rj.position.x * w
        const pivotY = -h + mH * 0.55 + rj.position.y * h
        const x = pivotX + Math.cos(jaw) * arm
        const y = pivotY - Math.sin(jaw) * arm + (i === 0 ? mH * 0.16 : -mH * 0.08) + (hovered ? mH * rj.hoverLift : 0)
        p.position.set(
          x + (i === 0 ? rj.card1 : rj.card2).x * mW,
          y + (i === 0 ? rj.card1 : rj.card2).y * mW,
          -HAND_DISTANCE + 0.05 + (i === 0 ? 0 : 0.02),
        )
        p.quaternion.setFromEuler(EULER_TMP.set(0, 0, -jaw))
        p.scaleFactor = (mW / MISSION_W) * (hovered ? rj.hoverScale : 1)
      }
    })
  })

  const active = view.phase === "playing" ? view.activePlayerId : null
  const crownPlayer =
    openingStep === "unroll" || openingStep === "deal"
      ? null
      : view.phase === "playing"
        ? view.activePlayerId
        : view.phase === "missions"
          ? (view.firstPlayerId ?? null)
          : null
  const results = view.results
  const winnerCenters = useWinnerCenters(results?.winners ?? EMPTY, zones)

  const subtle = intro || !!missionFocus
  const targetColumn = it.selection && it.canPlay("table") ? (it.selection.role === "spy" ? "queen" : it.selection.family) : null
  const candidates = new Set(it.assassination?.candidates ?? [])
  const targetDomain = (playerId: string) => !!it.selection && !it.assassination && it.canPlay(playerId === meId ? "domain" : "opponentDomain")
  const playDomain = (playerId: string) => it.play({ zone: "domain", playerId })

  return (
    <>
      <CameraRig />
      <CardSettingsPanel />
      <EndingSettings />
      <ZoneSettings />
      <MatLines results={results ?? null} ending={ending} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[4, 12, 6]} intensity={2.2} />
      <Table tex={tex} flow={flow} matDuration={settings.matDuration} />

      {[...board.values()].map(({ card, pose, playerId }) => {
        const candidate = candidates.has(card.id)
        const domainTarget = !!playerId && targetDomain(playerId)
        return (
          <Card3D
            key={card.id}
            target={pose}
            origin={origins.get(card.id)}
            front={tex.face(card)}
            backFace={tex.back}
            width={CARD_W}
            elevation={CARD_H}
            glow={candidate ? "red" : null}
            onHover={
              playerId
                ? (s) => {
                    if (it.assassination) hoverGroup(`${playerId}:${groupKey(card)}`, s)
                    if (domainTarget) setHoverPlayer(s ? playerId : null)
                  }
                : undefined
            }
            onClick={
              candidate
                ? (e) => {
                    e.stopPropagation()
                    it.eliminate(card.id)
                  }
                : domainTarget
                  ? (e) => {
                      e.stopPropagation()
                      playDomain(playerId)
                    }
                  : undefined
            }
          />
        )
      })}

      {visibleHand &&
        hand.map((card) => {
          const playable = it.myTurn && !it.assassination && !it.sending
          return (
            <Card3D
              key={card.id}
              target={cameraPose(card.id)}
              origin={origins.get(card.id) ?? deal.get(card.id)}
              front={tex.face(card)}
              backFace={tex.back}
              width={CARD_W}
              elevation={CARD_H}
              speed={0.12}
              reflection={card.id === hover || card.id === selectionId}
              onHover={(s) => setHover(s ? card.id : null)}
              onClick={
                playable
                  ? (e) => {
                      e.stopPropagation()
                      it.select(card.id === selectionId ? null : card)
                    }
                  : undefined
              }
            />
          )
        })}

      <FollowCamera>
        {visibleMissions &&
          !ending &&
          missions.map((m: Mission) => (
            <Card3D
              key={m.id}
              target={cameraPose(`mission:${m.id}`)}
              origin={missionOrigins.get(m.id)}
              front={tex.mission(m)}
              backFace={tex.missionBack(m)}
              width={MISSION_W}
              elevation={MISSION_H}
              above
              noShadow
              speed={
                hover === `mission:${m.id}` && !missionFocus
                  ? inGameMissionSettings.hoverDuration
                  : intro || missionFocus
                    ? 0.24
                    : focusReturn === m.id
                      ? inGameMissionSettings.defocusDuration
                      : inGameMissionSettings.returnDuration
              }
              reflectionIntensity={inGameMissionSettings.focusReflection}
              reflection={missionFocus === m.id}
              glow={null}
              onHover={(s) => setHover(s ? `mission:${m.id}` : null)}
              onClick={(e) => {
                e.stopPropagation()
                if (!intro) onMission(m.id)
              }}
            />
          ))}
      </FollowCamera>
      {visibleMissions &&
        !intro &&
        !ending &&
        missions.length > 0 &&
        view.players.map((j) => {
          const zone = zones.get(j.id)
          if (!zone || j.id === meId) return null
          const order = view.players.findIndex((x) => x.id === j.id)
          return [0, 1].map((k) => {
            const back = tex.missionBack(missions[k % missions.length]!)
            const origin = openingStep === "missions" ? { ...missionPilePose(MISSION_PILE.size + 2 + k), delay: 0.9 + (order * 2 + k) * 0.25 } : undefined
            return <Card3D key={`mission-dos-${j.id}-${k}`} target={restPose(zone, j.id, k)} origin={origin} front={back} backFace={back} width={MISSION_W} elevation={MISSION_H} noShadow />
          })
        })}
      {results && ending && (
        <>
          <FamilyResolution results={results} ending={ending} />
          <Counters view={view} results={results} ending={ending} zones={zones} />
          <PilePoints view={view} results={results} ending={ending} zones={zones} />
          {ending.spotlight &&
            winnerCenters.winnerZones.map((z, i) => (
              <Aura
                key={i}
                width={z.width}
                depth={z.depth}
                position={[z.center.x, 0.016, z.center.z]}
                yaw={z.yaw}
                strength={() => ENDING_SETTINGS.winnerStrength}
                settings={WINNER_AURA_SETTINGS}
              />
            ))}
          {view.players.map((j) => {
            const zone = zones.get(j.id)
            const list = j.id === meId ? missions : j.missions
            if (!zone || !list) return null
            const r = results.players.find((x) => x.playerId === j.id)
            return list.map((m, k) => {
              const target = missionRestPose(zone, k, m.id, ending.missions)
              const result = r?.missions.find((x) => x.missionId === m.id)
              return (
                <group key={m.id}>
                  <Card3D
                    target={target}
                    front={tex.mission(m)}
                    backFace={tex.missionBack(m)}
                    width={MISSION_W}
                    elevation={MISSION_H}
                    speed={0.22}
                    glow={null}
                  />
                  {ending.missions && result && <MissionSign done={result.done} points={result.points} position={[target.position.x, 0.12, target.position.z]} />}
                </group>
              )
            })
          })}
        </>
      )}
      <Veil active={subtle} opacity={missionFocus ? missionSettings.focusVeil : missionSettings.veil} fade={missionSettings.veilFade} />

      {transients.map((t) => (
        <Ephemeral key={t.id} item={t} tex={tex} onEnd={() => setTransients((l) => l.filter((x) => x.id !== t.id))} />
      ))}

      <Appear active={flow} delay={deckEnd(drawPileSettings)} duration={drawPileSettings.drop} elevation={drawPileSettings.elevation} mask>
        {Array.from({ length: missions.length > 0 ? MISSION_PILE.size : 0 }, (_, n) => {
          const back = tex.missionBack(missions[0]!)
          return <Card3D key={`mission-pile-${n}`} target={missionPilePose(n)} front={back} backFace={back} width={MISSION_W} elevation={MISSION_H} noShadow={n < MISSION_PILE.size - 1} />
        })}
      </Appear>
      <DrawPile count={view.deckCount} active={flow} settings={drawPileSettings} />
      <Appear active={flow} delay={deckEnd(drawPileSettings)} duration={drawPileSettings.drop} elevation={drawPileSettings.elevation} mask>
        {view.deckCount > 0 && (
          <Card3D target={deckTopPose(view.deckCount)} front={tex.back} backFace={tex.back} width={CARD_W} elevation={CARD_H} />
        )}
      </Appear>
      <Appear
        active={flow}
        delay={deckEnd(drawPileSettings) + drawPileSettings.drop + drawPileSettings.counterDelay}
        duration={0.7}
        elevation={-0.6}
      >
        <TableText
          text={String(view.deckCount)}
          style={{ color: "#fff4dc", relief: "#8a6a3a", aura: "rgba(255,236,190,0.9)", fontWeight: 800 }}
          elevation={0.85}
          position={[DRAW_PILE.x, 0.04, DRAW_PILE.z + CARD_H / 2 + 0.75]}
        />
      </Appear>

      {view.players.map((j) => {
        const zone = zones.get(j.id)
        if (!zone) return null
        return <DomainBackground key={`fond-${j.id}`} zone={zone} playable={targetDomain(j.id)} hover={hoverPlayer === j.id} color={color(j.id)} />
      })}

      <Appear active={flow} delay={0.2} duration={settings.matDuration * 0.4} elevation={-0.7}>
        {view.players.map((j) => {
          const zone = zones.get(j.id)
          if (!zone || j.id === meId) return null
          return (
            <Badge
              key={j.id}
              zone={zone}
              text={nickname(j.id).toUpperCase()}
              style={
                hoverPlayer === j.id && targetDomain(j.id)
                  ? { color: "#fff4dc", relief: color(j.id), aura: color(j.id), spacing: SPACING }
                  : j.id === active
                    ? { color: "#fff4dc", relief: color(j.id), aura: "rgba(255,236,190,0.9)", spacing: SPACING }
                    : { ...INK, spacing: SPACING }
              }
              onClick={targetDomain(j.id) ? () => playDomain(j.id) : undefined}
              onHover={targetDomain(j.id) ? (s) => setHoverPlayer(s ? j.id : null) : undefined}
            />
          )
        })}
      </Appear>

      {view.players.map((j) => {
        const zone = zones.get(j.id)
        if (!zone) return null
        const mine = j.id === meId
        // à gauche du pseudo (largeur estimée comme pour les cartes de fin) ; pour soi, là où le pseudo serait
        const x = mine ? 0 : -((nickname(j.id).length * 0.45 + 0.6) / 2 + 0.8)
        return (
          <CrownMark
            key={`couronne-${j.id}`}
            show={crownPlayer === j.id}
            origin={zone.labelPos}
            offset={[x, mine ? -0.5 : -ZONE_SETTINGS.nicknameOffset]}
            yaw={zone.labelYaw}
          />
        )
      })}

      {targetColumn &&
        (["up", "down"] as const).map((level) => (
          <Target key={level} column={targetColumn} level={level} onClick={() => it.play({ zone: "table", level })} />
        ))}

      {view.players.map((j) => {
        const zone = zones.get(j.id)
        if (!zone || !targetDomain(j.id)) return null
        return <ClickableZone key={j.id} zone={zone} onClick={() => playDomain(j.id)} onHover={(s) => setHoverPlayer(s ? j.id : null)} />
      })}
    </>
  )
}

export default function Scene3D(props: {
  openingStep: OpeningStep
  missionFocus: string | null
  onMission: (id: string) => void
  onEmpty: () => void
  onReady: () => void
  ending: EndingState | null
  settings: OpeningSettings
}) {
  return (
    <Canvas
      id="scene-3d"
      gl={{ preserveDrawingBuffer: true }}
      dpr={[1, 2]}
      camera={{ fov: 26.5, near: 0.1, far: 200, position: [0, 23, 13.5] }}
      onPointerMissed={props.onEmpty}
    >
      <Suspense fallback={null}>
        <World
          openingStep={props.openingStep}
          missionFocus={props.missionFocus}
          onMission={props.onMission}
          onReady={props.onReady}
          ending={props.ending}
          settings={props.settings}
        />
        <GamePhoto />
      </Suspense>
    </Canvas>
  )
}
