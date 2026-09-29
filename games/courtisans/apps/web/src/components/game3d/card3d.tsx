"use client"

import { useCursor } from "@react-three/drei"
import { type ThreeEvent, useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  type BufferGeometry,
  type Material,
  AdditiveBlending,
  CanvasTexture,
  ExtrudeGeometry,
  NormalBlending,
  RepeatWrapping,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  Quaternion,
  Shape,
  ShapeGeometry,
  type Texture,
  Vector3,
} from "three"
import { TessellateModifier } from "three/examples/jsm/modifiers/TessellateModifier.js"
import type { Pose } from "./layout"

const geometries = new Map<string, ShapeGeometry>()
const rims = new Map<string, ExtrudeGeometry>()

function shape(width: number, elevation: number, radius: number) {
  const x = -width / 2
  const y = -elevation / 2
  const s = new Shape()
  s.moveTo(x + radius, y)
  s.lineTo(x + width - radius, y)
  s.quadraticCurveTo(x + width, y, x + width, y + radius)
  s.lineTo(x + width, y + elevation - radius)
  s.quadraticCurveTo(x + width, y + elevation, x + width - radius, y + elevation)
  s.lineTo(x + radius, y + elevation)
  s.quadraticCurveTo(x, y + elevation, x, y + elevation - radius)
  s.lineTo(x, y + radius)
  s.quadraticCurveTo(x, y, x + radius, y)
  return s
}

export function edgeGeometry(width: number, elevation: number, thickness: number, radius = Math.min(width, elevation) * 0.06) {
  const key = `${width.toFixed(3)}:${elevation.toFixed(3)}:${thickness.toFixed(4)}:${radius.toFixed(3)}`
  let geo = rims.get(key)
  if (!geo) {
    geo = new ExtrudeGeometry(shape(width, elevation, radius), { depth: thickness, bevelEnabled: false, curveSegments: 6 })
    rims.set(key, geo)
  }
  return geo
}

const frames = new Map<string, ShapeGeometry>()

function frameGeometry(width: number, elevation: number, gap: number, thickness: number) {
  const key = `${width.toFixed(3)}:${elevation.toFixed(3)}:${gap.toFixed(3)}:${thickness.toFixed(3)}`
  let geo = frames.get(key)
  if (!geo) {
    const radius = Math.min(width, elevation) * 0.06
    const outer = shape(width + 2 * (gap + thickness), elevation + 2 * (gap + thickness), radius + gap + thickness)
    outer.holes.push(shape(width + 2 * gap, elevation + 2 * gap, radius + gap))
    geo = new ShapeGeometry(outer, 8)
    frames.set(key, geo)
  }
  return geo
}

export function cardGeometry(width: number, elevation: number, radius = Math.min(width, elevation) * 0.06) {
  const key = `${width.toFixed(3)}:${elevation.toFixed(3)}:${radius.toFixed(3)}`
  let geo = geometries.get(key)
  if (!geo) {
    const x = -width / 2
    const y = -elevation / 2
    geo = new ShapeGeometry(shape(width, elevation, radius), 6)
    const pos = geo.attributes.position!
    const uv = geo.attributes.uv!
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - x) / width, (pos.getY(i) - y) / elevation)
    uv.needsUpdate = true
    geometries.set(key, geo)
  }
  return geo
}

function sparkleTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 256
  const g = c.getContext("2d")!
  const grad = g.createLinearGradient(0, 256, 256, 0)
  grad.addColorStop(0.42, "rgba(255,255,255,0)")
  grad.addColorStop(0.5, "rgba(255,250,230,0.8)")
  grad.addColorStop(0.58, "rgba(255,255,255,0)")
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * 256
    const y = Math.random() * 256
    const r = 2 + Math.random() * 4
    g.fillStyle = "rgba(255,255,255,0.9)"
    g.fillRect(x - r, y - 0.6, r * 2, 1.2)
    g.fillRect(x - 0.6, y - r, 1.2, r * 2)
  }
  const t = new CanvasTexture(c)
  t.wrapS = RepeatWrapping
  return t
}

let reflectionTex: CanvasTexture | null = null
function reflectionTexture() {
  if (reflectionTex) return reflectionTex
  const c = document.createElement("canvas")
  c.width = c.height = 256
  const g = c.getContext("2d")!
  const grad = g.createLinearGradient(0, 256, 256, 0)
  grad.addColorStop(0.25, "rgba(255,255,255,0)")
  grad.addColorStop(0.42, "rgba(255,245,220,0.3)")
  grad.addColorStop(0.5, "rgba(255,255,255,0.6)")
  grad.addColorStop(0.53, "rgba(255,255,255,0.2)")
  grad.addColorStop(0.6, "rgba(255,245,220,0.35)")
  grad.addColorStop(0.75, "rgba(255,255,255,0)")
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  const t = new CanvasTexture(c)
  t.repeat.set(0.6, 0.6)
  t.center.set(0.5, 0.5)
  reflectionTex = t
  return t
}

let shadowTex: CanvasTexture | null = null
function shadowTexture() {
  if (!shadowTex) {
    const c = document.createElement("canvas")
    c.width = c.height = 128
    const g = c.getContext("2d")!
    const grad = g.createRadialGradient(64, 64, 20, 64, 64, 64)
    grad.addColorStop(0, "rgba(0,0,0,0.55)")
    grad.addColorStop(1, "rgba(0,0,0,0)")
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    shadowTex = new CanvasTexture(c)
  }
  return shadowTex
}

const halos = new Map<string, CanvasTexture>()

function textureHalo(width: number, elevation: number, margin: number) {
  const key = `${width.toFixed(2)}:${elevation.toFixed(2)}:${margin.toFixed(2)}`
  let t = halos.get(key)
  if (!t) {
    const scaleFactor = 160 / (width + 2 * margin)
    const c = document.createElement("canvas")
    c.width = Math.round((width + 2 * margin) * scaleFactor)
    c.height = Math.round((elevation + 2 * margin) * scaleFactor)
    const g = c.getContext("2d")!
    g.shadowColor = "white"
    g.shadowBlur = margin * scaleFactor * 0.9
    g.fillStyle = "white"
    const r = Math.min(width, elevation) * 0.06 * scaleFactor
    g.beginPath()
    g.roundRect(margin * scaleFactor, margin * scaleFactor, width * scaleFactor, elevation * scaleFactor, r)
    g.fill()
    g.fill()
    t = new CanvasTexture(c)
    halos.set(key, t)
  }
  return t
}

const GLOW_COLORS = {
  gold: "#f2c14e",
  selection: "#ffffff",
  red: "#ff4d4d",
  white: "#ffffff",
} as const
export type Glow = keyof typeof GLOW_COLORS

export const CARD_SETTINGS = {
  assassinColor: "#ff4d4d",
  assassinHalo: 0.75,
  assassinPulse: 0.06,
  assassinOutline: true,
  goldColor: "#f2c14e",
  goldHalo: 0.35,
  goldPulse: 0.03,
  sparkle: 0.55,
  sparkleSpeed: 0.35,
  pulseSpeed: 1.6,
  selectionColor: "#ffffff",
  frameOpacity: 0.75,
  framePulse: 0.2,
  frameBreath: 0.012,
  frameSpeed: 3,
  reflection: 0.5,
  reflectionMotion: 0.45,
  shadow: 0.06,
  flightDuration: 1.2,
  flightHeight: 1.9,
  thickness: 0.005,
  foldable: 0.04,
}

const foldables = new Map<BufferGeometry, BufferGeometry>()
function foldable(geo: BufferGeometry, size: number) {
  let g = foldables.get(geo)
  if (!g) {
    g = new TessellateModifier(size, 8).modify(geo)
    foldables.set(geo, g)
  }
  return g
}

function fold(m: Material | null, uniforms: Record<string, { value: number }>) {
  if (!m || m.userData.folded) return
  m.userData.folded = true
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uFold;\nuniform float uHalfH;\nuniform float uDir;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nfloat pyPli = clamp(position.y / uHalfH, -1.0, 1.0);\ntransformed.z += uDir * uFold * uHalfH * (1.0 - pyPli * pyPli);",
      )
  }
  m.customProgramCacheKey = () => "fold"
  m.needsUpdate = true
}

type Props = {
  target: Pose
  origin?: Pose | null
  front: Texture
  backFace: Texture
  width: number
  elevation: number
  glow?: Glow | null
  speed?: number
  onClick?: (e: ThreeEvent<MouseEvent>) => void
  onHover?: (hover: boolean) => void
  reflection?: boolean
  above?: boolean
  noShadow?: boolean
  reflectionIntensity?: number
  onArrive?: () => void
}

const targetTmp = new Vector3()
const scaleTmp = new Vector3()
const normalTmp = new Vector3()
const p1 = new Vector3()
const p2 = new Vector3()
const qTmp = new Quaternion()
const UP = new Vector3(0, 1, 0)

type Flight = { t: number; duration: number; p0: Vector3; q0: Quaternion; s0: number; lift: number; dir: number }

const easeInOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2)

function bezier(out: Vector3, a: Vector3, b: Vector3, c: Vector3, d: Vector3, t: number) {
  const m = 1 - t
  return out
    .copy(a)
    .multiplyScalar(m * m * m)
    .addScaledVector(b, 3 * m * m * t)
    .addScaledVector(c, 3 * m * t * t)
    .addScaledVector(d, t * t * t)
}

export function Card3D({
  target,
  origin,
  front,
  backFace,
  width,
  elevation,
  glow,
  speed = 0.16,
  onClick,
  onHover,
  reflection,
  above,
  noShadow,
  reflectionIntensity,
  onArrive,
}: Props) {
  const ref = useRef<Group>(null)
  const thickness = width * CARD_SETTINGS.thickness
  const step = Math.min(width, elevation) / 5
  const geo = useMemo(() => foldable(cardGeometry(width, elevation), step), [width, elevation, step])
  const rim = useMemo(() => foldable(edgeGeometry(width, elevation, thickness), step), [width, elevation, thickness, step])
  const foldAmount = useRef({ value: 0 })
  const margin = 0.05 / Math.max(target.scaleFactor, 0.3)
  const glowGeo = useMemo(() => cardGeometry(width + margin, elevation + margin), [width, elevation, margin])
  const haloMargin = Math.min(width, elevation) * (glow === "gold" ? 0.14 : 0.28)
  const frameRef = useRef<Mesh>(null)
  const halo = useMemo(() => textureHalo(width, elevation, haloMargin), [width, elevation, haloMargin])
  const haloRef = useRef<MeshBasicMaterial>(null)
  const sparkleRef = useRef<Mesh>(null)
  const [texSparkle] = useState(sparkleTexture)
  const outlineThickness = 0.03 / Math.max(target.scaleFactor, 0.3)
  const gap = 0.07 / Math.max(target.scaleFactor, 0.3)
  const frameGeo = useMemo(() => frameGeometry(width, elevation, gap, outlineThickness), [width, elevation, gap, outlineThickness])
  const [hover, setHover] = useState(false)
  const [shadow] = useState(shadowTexture)
  const shadowRef = useRef<Mesh>(null)
  const reflectionRef = useRef<Mesh>(null)
  const outlineRef = useRef<Mesh>(null)
  const [texReflection] = useState(reflectionTexture)
  const flight = useRef<Flight | null>(null)
  const last = useRef(new Vector3())
  useCursor(hover && !!onClick)

  const launch = (g: Group, delay = 0) => {
    const distance = g.position.distanceTo(target.position)
    flight.current = {
      t: -delay,
      duration: Math.min(1.6, Math.max(1.05, 0.95 + distance * 0.04)) * CARD_SETTINGS.flightDuration,
      p0: g.position.clone(),
      q0: g.quaternion.clone(),
      s0: g.scale.x,
      lift: Math.min(5.5, 1.8 + distance * 0.3) * CARD_SETTINGS.flightHeight,
      dir: Math.random() < 0.5 ? -1 : 1,
    }
  }

  useLayoutEffect(() => {
    const g = ref.current
    if (!g) return
    const p = origin ?? target
    g.position.copy(p.position)
    g.quaternion.copy(p.quaternion)
    g.scale.setScalar(p.scaleFactor)
    last.current.copy(target.position)
    if (origin) launch(g, origin.delay ?? 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame(({ pointer, clock }, dt) => {
    const R = CARD_SETTINGS
    const wave = Math.sin(clock.elapsedTime * R.pulseSpeed)
    if (haloRef.current) {
      haloRef.current.opacity = glow === "red" ? R.assassinHalo + wave * R.assassinPulse : R.goldHalo + wave * R.goldPulse
      if (glow === "red") haloRef.current.color.set(R.assassinColor)
      else if (glow === "gold") haloRef.current.color.set(R.goldColor)
    }
    if (outlineRef.current) {
      outlineRef.current.visible = R.assassinOutline
      ;(outlineRef.current.material as MeshBasicMaterial).color.set(R.assassinColor)
    }
    if (shadowRef.current) (shadowRef.current.material as MeshBasicMaterial).opacity = R.shadow
    const frame = frameRef.current
    if (frame) {
      const t = clock.elapsedTime
      frame.scale.setScalar(1 + Math.sin(t * R.frameSpeed) * R.frameBreath)
      const m = frame.material as MeshBasicMaterial
      m.opacity = R.frameOpacity + Math.sin(t * R.frameSpeed) * R.framePulse
      m.color.set(R.selectionColor)
    }
    const sc = sparkleRef.current
    if (sc) {
      sc.visible = glow === "gold"
      if (sc.visible) {
        const m = sc.material as MeshBasicMaterial
        if (m.map) m.map.offset.x = ((clock.elapsedTime * R.sparkleSpeed) % 1.6) - 0.8
        m.opacity = R.sparkle
      }
    }
    const r = reflectionRef.current
    if (r) {
      const m = r.material as MeshBasicMaterial
      easing.damp(m, "opacity", reflection ? (reflectionIntensity ?? R.reflection) : 0, 0.3, dt)
      r.visible = m.opacity > 0.01
      if (reflection) {
        easing.damp(texReflection.offset, "x", -pointer.x * R.reflectionMotion, 0.15, dt)
        easing.damp(texReflection.offset, "y", -pointer.y * R.reflectionMotion, 0.15, dt)
      }
    }
    const g = ref.current
    if (!g) return
    if (!flight.current && target.position.distanceTo(last.current) > 4 && g.position.distanceTo(target.position) > 4) launch(g)
    last.current.copy(target.position)

    const v = flight.current
    if (v) {
      v.t += dt
      if (v.t >= 0) {
        const u = Math.min(1, v.t / v.duration)
        const e = easeInOut(u)
        p1.copy(v.p0).addScaledVector(UP, v.p0.y > 8 ? 0 : v.lift)
        p2.copy(target.position).addScaledVector(UP, target.position.y > 8 ? 0 : v.lift * 0.85)
        bezier(g.position, v.p0, p1, p2, target.position, e)
        g.quaternion.slerpQuaternions(v.q0, target.quaternion, e).premultiply(qTmp.setFromAxisAngle(UP, Math.sin(Math.PI * e) * 0.45 * v.dir))
        g.scale.setScalar((v.s0 + (target.scaleFactor - v.s0) * e) * (1 + Math.sin(Math.PI * u) * 0.14))
        foldAmount.current.value = CARD_SETTINGS.foldable * Math.sin(Math.PI * u) * v.dir
        if (u >= 1) {
          flight.current = null
          onArrive?.()
        }
      }
    } else {
      foldAmount.current.value *= Math.max(0, 1 - dt * 8)
      targetTmp.copy(target.position)
      easing.damp3(g.position, targetTmp, speed, dt)
      easing.dampQ(g.quaternion, target.quaternion, speed, dt)
      easing.damp3(g.scale, scaleTmp.setScalar(target.scaleFactor), speed, dt)
    }
    if (shadowRef.current) {
      const top = normalTmp.set(0, 0, 1).applyQuaternion(g.quaternion).y >= 0
      shadowRef.current.position.z = top ? -thickness / 2 - 0.012 : thickness / 2 + 0.012
    }
  })

  return (
    <group
      ref={ref}
      renderOrder={above ? 20 : 0}
      onClick={onClick}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHover(true)
        onHover?.(true)
      }}
      onPointerOut={() => {
        setHover(false)
        onHover?.(false)
      }}
    >
      <mesh ref={shadowRef} position={[0.04, -0.07, -0.03]} raycast={() => null} visible={!noShadow}>
        <planeGeometry args={[width * 1.18, elevation * 1.1]} />
        <meshBasicMaterial map={shadow} transparent depthWrite={false} />
      </mesh>
      <mesh geometry={geo} position-z={thickness / 2 + 0.001}>
        <meshBasicMaterial
          ref={(m) => fold(m, { uFold: foldAmount.current, uHalfH: { value: elevation / 2 }, uDir: { value: 1 } })}
          map={front}
          transparent={above}
          toneMapped={false}
        />
      </mesh>
      <mesh geometry={rim} position-z={-thickness / 2}>
        <meshBasicMaterial attach="material-0" visible={false} />
        <meshBasicMaterial
          attach="material-1"
          ref={(m) => fold(m, { uFold: foldAmount.current, uHalfH: { value: elevation / 2 }, uDir: { value: 1 } })}
          color="#d9cba6"
          transparent={above}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={reflectionRef} geometry={geo} position-z={thickness / 2 + 0.003} raycast={() => null} visible={false}>
        <meshBasicMaterial map={texReflection} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh geometry={geo} rotation-y={Math.PI} position-z={-thickness / 2 - 0.001}>
        <meshBasicMaterial
          ref={(m) => fold(m, { uFold: foldAmount.current, uHalfH: { value: elevation / 2 }, uDir: { value: -1 } })}
          map={backFace}
          transparent={above}
          toneMapped={false}
        />
      </mesh>
      {glow && glow !== "selection" && (
        <mesh position-z={-thickness / 2 - 0.006} raycast={() => null}>
          <planeGeometry args={[width + 2 * haloMargin, elevation + 2 * haloMargin]} />
          <meshBasicMaterial
            ref={haloRef}
            map={halo}
            color={GLOW_COLORS[glow]}
            transparent
            depthWrite={false}
            blending={glow === "red" ? NormalBlending : AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      )}
      <mesh ref={sparkleRef} geometry={geo} position-z={thickness / 2 + 0.004} raycast={() => null} visible={false}>
        <meshBasicMaterial map={texSparkle} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {glow === "selection" && (
        <mesh ref={frameRef} geometry={frameGeo} position-z={thickness / 2 + 0.002} raycast={() => null}>
          <meshBasicMaterial color="#ffffff" transparent toneMapped={false} />
        </mesh>
      )}
      {glow === "red" && (
        <mesh ref={outlineRef} geometry={glowGeo} position-z={-thickness / 2 - 0.003} raycast={() => null}>
          <meshBasicMaterial color={GLOW_COLORS.red} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}
