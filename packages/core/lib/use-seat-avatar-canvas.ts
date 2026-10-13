"use client"

import { useEffect, useMemo, useState } from "react"
import type { SeatAvatar } from "./seat-avatar"
import { seatAvatarCanvas, seatFontFamily } from "./seat-avatar-canvas"
import type { SeatTheme } from "./ui-theme"

/**
 * An account picture (PLT-13), once it has loaded. `null` until then, and for good when it cannot be fetched: the generated avatar
 * stays. The picture is requested with CORS, as a canvas texture needs: a host that does not allow it behaves as a broken link.
 */
export function useAvatarImage(url: string | null): HTMLImageElement | null {
  const [loaded, setLoaded] = useState<{ url: string; image: HTMLImageElement } | null>(null)
  useEffect(() => {
    if (!url) return
    let active = true
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.onload = () => {
      if (active) setLoaded({ url, image })
    }
    image.src = url
    return () => {
      active = false
      image.onload = null
    }
  }, [url])
  return loaded?.url === url ? loaded.image : null
}

/** The font-family a theme's `font` resolves to on this page, once the font has loaded (`null` before: a canvas painted too early would use a fallback) */
function useFontFamily(font: string, text: string): string | null {
  const [ready, setReady] = useState<{ key: string; family: string } | null>(null)
  const key = `${font}|${text}`
  useEffect(() => {
    let active = true
    const family = seatFontFamily(font)
    Promise.resolve(document.fonts?.load(`900 40px ${family}`, text))
      .catch(() => null)
      .then(() => {
        if (active) setReady({ key, family })
      })
    return () => {
      active = false
    }
  }, [font, text, key])
  return ready?.key === key ? ready.family : null
}

/**
 * The canvas of a player's seat avatar, for a 3D table (the game wraps it in a texture). Painted once the font has loaded, and again
 * when an account picture arrives. `null` before that and outside a browser.
 */
export function useSeatAvatarCanvas(avatar: SeatAvatar, theme: SeatTheme, px = 256): HTMLCanvasElement | null {
  const { initial, color, ink, imageUrl } = avatar
  const { shape, ring, font, name } = theme
  const image = useAvatarImage(imageUrl)
  const family = useFontFamily(font, initial)
  return useMemo(
    () => (family === null ? null : seatAvatarCanvas({ initial, color, ink, imageUrl }, { shape, ring, font, name }, px, image, family)),
    [initial, color, ink, imageUrl, shape, ring, font, name, px, image, family],
  )
}
