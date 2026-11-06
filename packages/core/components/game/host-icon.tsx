"use client"

import { CrownIcon } from "lucide-react"
import { useSkin, useText } from "../skin-provider"

/**
 * Host pictogram: the skin's image (a mask tinted with the current color), else a crown. `className` replaces the default
 * classes; `size` only swaps the default size (a `size-*` class). Drawn by the game over and by the start announcement.
 */
export function HostIcon({ className, size }: { className?: string; size?: string }) {
  const { hostIcon } = useSkin()
  const t = useText()
  if (!hostIcon) return <CrownIcon aria-label={t("host")} className={className ?? size ?? "size-6"} />
  return (
    <span
      aria-label={t("host")}
      role="img"
      className={className ?? `inline-block ${size ?? "size-7"} shrink-0 bg-current`}
      style={{ maskImage: `url(${hostIcon})`, maskSize: "contain", maskRepeat: "no-repeat", maskPosition: "center" }}
    />
  )
}
