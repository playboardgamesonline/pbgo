"use client"

import { useEffect, useState, type CSSProperties, type ReactNode } from "react"
import { cn } from "@pbgo/ui/utils"

/**
 * The in-game components are sized for a screen. These two draw them at their real size and scale the result down to the column
 * of this page, so a specimen is the component itself, not a redrawing. Both stay hidden until the first measure, so nothing
 * flashes at full size.
 */

function useWidth() {
  const [node, setNode] = useState<HTMLElement | null>(null)
  const [width, setWidth] = useState<number | null>(null)
  useEffect(() => {
    if (!node) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])
  return [setNode, width] as const
}

/**
 * A reference screen (1280 × 720 by default) scaled to the width available. `--vh` is a hundredth of its height, so the announcements
 * size like a screen of that height (see `vh()` in `lib/announcement-settings.ts`); the stage clips and is the containing block of
 * what is absolute inside it.
 */
export function Stage({ width = 1280, height = 720, className, children }: { width?: number; height?: number; className?: string; children: ReactNode }) {
  const [ref, outer] = useWidth()
  const scale = outer ? outer / width : 1
  return (
    <div ref={ref} className={cn("relative w-full overflow-hidden", className)} style={{ aspectRatio: `${width} / ${height}`, visibility: outer === null ? "hidden" : undefined }}>
      <div className="absolute top-0 left-0 origin-top-left overflow-hidden" style={{ width, height, transform: `scale(${scale})`, "--vh": `${height / 100}px` } as CSSProperties}>
        {children}
      </div>
    </div>
  )
}

/** A block of a fixed width and any height (the game-over panel), scaled down to fit when the column is narrower, never up */
export function Fit({ width, className, children }: { width: number; className?: string; children: ReactNode }) {
  const [ref, outer] = useWidth()
  const [inner, setInner] = useState<HTMLElement | null>(null)
  const [height, setHeight] = useState<number | null>(null)
  useEffect(() => {
    if (!inner) return
    const observer = new ResizeObserver(([entry]) => setHeight((entry.target as HTMLElement).offsetHeight))
    observer.observe(inner)
    return () => observer.disconnect()
  }, [inner])
  const scale = outer ? Math.min(1, outer / width) : 1
  return (
    <div ref={ref} className={className} style={{ height: height === null ? undefined : height * scale, visibility: outer === null || height === null ? "hidden" : undefined }}>
      <div ref={setInner} className="mx-auto origin-top-left" style={{ width, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  )
}
