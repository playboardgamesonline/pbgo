"use client"

import { useEffect, useState } from "react"

/** True once the font the table writes with has loaded, so that what is painted on a canvas is painted again in it and not in the font that stood in for it */
export function useFontReady(font: string, weight = 700): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let live = true
    Promise.resolve(document.fonts?.load(`${weight} 40px ${font}`))
      .catch(() => null)
      .then(() => live && setReady(true))
    return () => {
      live = false
    }
  }, [font, weight])
  return ready
}
