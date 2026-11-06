"use client"

import { Card, CARD_SETTINGS, type CameraSettings, onTable } from "@pbgo/table"
import { useEffect, useRef } from "react"
import type { FlightKnobs } from "../defaults"
import { back, CARD_SIZE, face } from "./art"
import { Stage } from "./parts"

// A card sent across the table flies instead of gliding: it rises on a curve, turns a little, swells and bends (the fold). How long, how high and how much are three fields of `CARD_SETTINGS`, ONE object shared by every card of the page, so this
// scene writes the three sliders into it while it is on the page and puts back what it found when it leaves. It does not know the starting values: it reads them from the object and tells the controls (`onDefaults`), which wait for them.

const CAMERA: CameraSettings = { tilt: 36, yaw: 0, distance: 16, fov: 34, targetX: 0, targetZ: 0 }

/** The two ends of the flight, farther apart than a card glides. */
const POSES = { left: onTable(-4.8, 0, { yaw: 0.06 }), right: onTable(4.8, 0, { yaw: -0.06 }) }

export function FlightScene({ side, knobs, onDefaults }: { side: "left" | "right"; knobs: FlightKnobs | null; onDefaults: (found: FlightKnobs) => void }) {
  // The newest props, for the effect that runs once
  const latest = useRef({ knobs, onDefaults })
  useEffect(() => {
    latest.current = { knobs, onDefaults }
  })
  useEffect(() => {
    const found: FlightKnobs = { flightDuration: CARD_SETTINGS.flightDuration, flightHeight: CARD_SETTINGS.flightHeight, foldable: CARD_SETTINGS.foldable }
    if (latest.current.knobs === null) latest.current.onDefaults(found)
    return () => {
      Object.assign(CARD_SETTINGS, found)
    }
  }, [])
  useEffect(() => {
    if (knobs) Object.assign(CARD_SETTINGS, knobs)
  }, [knobs])

  return (
    <Stage id="scene-flight" camera={CAMERA} playIntro={false}>
      <Card target={POSES[side]} front={face(25)} back={back()} size={CARD_SIZE} />
    </Stage>
  )
}
