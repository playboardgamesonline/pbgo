"use client"

import { useFrame, useThree } from "@react-three/fiber"
import { type RefObject, useEffect, useRef, useState } from "react"
import { type Object3D, Vector3 } from "three"

/** What makes the keyboard stand-in invisible and still focusable: one pixel, clipped, over the thing's place */
const SR_ONLY: Partial<CSSStyleDeclaration> = { position: "absolute", width: "1px", height: "1px", margin: "-1px", padding: "0", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: "0", pointerEvents: "none" }
const centre = new Vector3()

/** The stand-ins are placed in their parent's own frame: make it one (it is the canvas's wrapper, which has no other positioning) */
function positioned(parent: HTMLElement) {
  if (getComputedStyle(parent).position === "static") parent.style.position = "relative"
}

/**
 * The keyboard stand-in of anything on the table that can be pressed, a floor button or a card: a canvas takes no keyboard, so a pressable thing puts one real, visually hidden `<button>` in the page. It takes Tab, says `name` to a screen reader and
 * presses with Enter or Space. It is made by hand (a DOM node cannot be a child of the canvas's scene) and stays over the thing, so a screen reader's pointer and the browser's scrolling to the focus land where the thing is. A thing with no `name` has none.
 *
 * `anchor` is the object the stand-in follows; `onTable` puts its place on the table (a pad), where a card's is wherever the card is, lifted or tilted. Returns whether the focus is on it and the browser draws a ring on it (`:focus-visible`): a pointer press does not count,
 * so it does not leave a thing in its lifted look.
 */
export function useStandIn({ pressable, name, onPress, anchor, onTable = false }: { pressable: boolean; name: string | undefined; onPress: (() => void) | undefined; anchor: RefObject<Object3D | null>; onTable?: boolean }): boolean {
  const { gl } = useThree()
  const [focused, setFocused] = useState(false)
  const standIn = useRef<HTMLButtonElement | null>(null)
  const latest = useRef({ onPress })
  useEffect(() => {
    latest.current = { onPress }
  })
  useEffect(() => {
    const parent = gl.domElement.parentElement
    if (!pressable || name === undefined || !parent) return
    positioned(parent)
    const el = document.createElement("button")
    el.type = "button"
    el.setAttribute("aria-label", name)
    Object.assign(el.style, SR_ONLY)
    el.addEventListener("focus", () => setFocused(el.matches(":focus-visible")))
    el.addEventListener("blur", () => setFocused(false))
    el.addEventListener("click", () => latest.current.onPress?.())
    parent.appendChild(el)
    standIn.current = el
    return () => {
      el.remove()
      standIn.current = null
      setFocused(false)
    }
  }, [gl, pressable, name])
  useFrame(({ camera, size }) => {
    const el = standIn.current
    const object = anchor.current
    if (!el || !object) return
    object.getWorldPosition(centre)
    if (onTable) centre.setY(0)
    centre.project(camera)
    const left = `${Math.round(((centre.x + 1) / 2) * size.width)}px`
    const top = `${Math.round(((1 - centre.y) / 2) * size.height)}px`
    if (el.style.left !== left) el.style.left = left
    if (el.style.top !== top) el.style.top = top
  })
  return focused
}
