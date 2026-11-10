"use client"

import * as leva from "leva"
import { Leva, LevaPanel, button, useControls } from "leva"
import { useEffect, useRef, useState } from "react"
import { cn } from "@pbgo/ui/utils"
import { roundValue, DEBUG_STORES, DEBUG_TABS, type DebugTab } from "./debug-tabs"
import { useDebugRequested, useDebugShortcut } from "./debug-controls"
import { type DebugFolder, useDebugFolders } from "./debug-folders"

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
  console.info("Debug settings", values)
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
  return <span ref={ref} className="w-32 shrink-0 self-center px-2 text-right whitespace-nowrap tabular-nums" />
}

/** One folder the board asked for (`useDebugFolder`): its inputs are made here, where leva is, and stay as long as the board asks for the folder. Draws nothing itself: the panel shows the store */
function Folder({ entry }: { entry: DebugFolder }) {
  useControls(entry.folder, entry.schema(leva) as never, { collapsed: entry.closed, order: entry.order }, { store: DEBUG_STORES[entry.tab] }, entry.deps)
  return null
}

export function DebugPanel() {
  useControls({ "Copy all settings": button(copyAll) })
  const [activeTab, setActiveTab] = useState<DebugTab>("GAME")
  const active = useDebugRequested()
  const folders = useDebugFolders()
  useDebugShortcut()

  return (
    <div className={cn("absolute top-44 left-4 z-40 w-[27rem]", !active && "hidden")}>
      {folders.map((entry) => (
        <Folder key={entry.id} entry={entry} />
      ))}
      <div className="flex gap-px overflow-hidden rounded-t-md bg-[#292d39] font-mono text-[10px] tracking-wider">
        {DEBUG_TABS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setActiveTab(name)}
            className={cn("min-w-0 flex-1 basis-0 py-2 text-[#8c92a4] hover:text-white", activeTab === name && "bg-[#181c20] text-white")}
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
