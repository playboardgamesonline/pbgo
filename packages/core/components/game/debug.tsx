"use client"

import { Leva, LevaPanel, button, useControls } from "leva"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { cn } from "@pbgo/ui/utils"
import { roundValue, DEBUG_STORES, DEBUG_TABS, type DebugTab } from "./debug-tabs"

const STORAGE_KEY = "game:debug"
const subscribers = new Set<() => void>()

function read() {
  try {
    return new URLSearchParams(window.location.search).has("debug") || localStorage.getItem(STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

function toggle() {
  try {
    localStorage.setItem(STORAGE_KEY, read() ? "0" : "1")
    const url = new URL(window.location.href)
    if (url.searchParams.has("debug")) {
      url.searchParams.delete("debug")
      window.history.replaceState(null, "", url)
    }
  } catch {}
  subscribers.forEach((f) => f())
}

function copyAll() {
  const values: Record<string, Record<string, unknown>> = {}
  for (const name of DEBUG_TABS) {
    const payload = DEBUG_STORES[name].getData() as Record<string, { type?: string; value?: unknown }>
    for (const [route, entry] of Object.entries(payload)) {
      if (!entry || entry.type === "BUTTON" || entry.value === undefined) continue
      ;(values[name] ??= {})[route] = entry.value
    }
  }
  const text = JSON.stringify(values, roundValue, 2)
  navigator.clipboard?.writeText(text).catch(() => null)
  console.info("Réglages debug", values)
}

function Fps() {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let id = 0
    let images = 0
    let start = performance.now()
    let worst = 0
    let previous = start
    const loop = (t: number) => {
      images++
      worst = Math.max(worst, t - previous)
      previous = t
      if (t - start >= 500) {
        const fps = Math.round((images * 1000) / (t - start))
        const el = ref.current
        if (el) {
          el.textContent = `${fps} FPS · ${Math.round(worst)}ms`
          el.style.color = fps >= 50 ? "#7ee787" : fps >= 30 ? "#f2cc60" : "#ff7b72"
        }
        images = 0
        worst = 0
        start = t
      }
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [])
  return <span ref={ref} className="shrink-0 self-center px-3 tabular-nums" />
}

export function DebugPanel() {
  useControls({ "Copy all settings": button(copyAll) })
  const [activeTab, setActiveTab] = useState<DebugTab>("GAME")
  const active = useSyncExternalStore(
    (f) => {
      subscribers.add(f)
      return () => subscribers.delete(f)
    },
    read,
    () => false,
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key.toLowerCase() === "d" && !(e.target instanceof HTMLInputElement)) toggle()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <div className={cn("absolute top-44 left-4 z-40 w-[27rem]", !active && "hidden")}>
      <div className="flex gap-px overflow-hidden rounded-t-md bg-[#292d39] font-mono text-[10px] tracking-wider">
        {DEBUG_TABS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setActiveTab(name)}
            className={cn("flex-1 py-2 text-[#8c92a4] hover:text-white", activeTab === name && "bg-[#181c20] text-white")}
          >
            {name}
          </button>
        ))}
        {active && <Fps />}
      </div>
      <Leva hidden />
      {active && (
        <div className="max-h-[min(60vh,calc(100dvh-14rem))] overflow-y-auto rounded-b-md bg-[#181c20] [scrollbar-width:thin]">
          <LevaPanel
            key={activeTab}
            store={DEBUG_STORES[activeTab]}
            fill
            flat
            collapsed={false}
            titleBar={{ title: "Debug · Shift+D", filter: false }}
          />
        </div>
      )}
    </div>
  )
}
