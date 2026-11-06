"use client"

import dynamic from "next/dynamic"

// The one way into three.js, @react-three/fiber and @pbgo/table from the docs: each scene of `three/` is a chunk of its own, loaded in the browser only (`ssr: false`), and only once a frame asks for it by drawing it. No other file of the app imports
// those packages, so a page of the docs with no scene, and the hub, load none of it. The light half of a specimen (`specimens.tsx`) imports these names and nothing from `three/`.

export const BoardScene = dynamic(() => import("./three/board").then((m) => m.BoardScene), { ssr: false })
export const TableScene = dynamic(() => import("./three/table").then((m) => m.TableScene), { ssr: false })
export const CameraScene = dynamic(() => import("./three/camera").then((m) => m.CameraScene), { ssr: false })
export const CardScene = dynamic(() => import("./three/card").then((m) => m.CardScene), { ssr: false })
export const GlowsScene = dynamic(() => import("./three/glows").then((m) => m.GlowsScene), { ssr: false })
export const FlightScene = dynamic(() => import("./three/flight").then((m) => m.FlightScene), { ssr: false })
export const PoseMemoryScene = dynamic(() => import("./three/pose-memory").then((m) => m.PoseMemoryScene), { ssr: false })
export const LayoutsScene = dynamic(() => import("./three/layouts").then((m) => m.LayoutsScene), { ssr: false })
export const ZonesScene = dynamic(() => import("./three/zones").then((m) => m.ZonesScene), { ssr: false })
export const PileScene = dynamic(() => import("./three/pile").then((m) => m.PileScene), { ssr: false })
export const SeatsScene = dynamic(() => import("./three/seats").then((m) => m.SeatsScene), { ssr: false })
