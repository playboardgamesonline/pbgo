"use client"

import { Component, createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { Button } from "@pbgo/ui/platform/button"
import { cn } from "@pbgo/ui/utils"

// The frame every 3D specimen is drawn in. It knows nothing of three.js: it holds the box (a fixed ratio, so the page does not move when a scene arrives), starts the scene only when the box is near the window and lets it go when
// the box is far, so that a page never keeps more than a few WebGL contexts alive, and says in words what the scene is when WebGL is missing or stops. The scene itself is `children`, a lazy component that is not even
// downloaded until the frame asks for it; the controls under it are the platform's own and work before any of that.

/** How far outside the window the box starts its scene, as an observer margin. */
const NEAR = "320px 0px"
/** Milliseconds a scene is kept after its box left that margin, so that a jiggle of the scroll does not restart it. */
const LET_GO_AFTER = 4000

type Mode = "idle" | "live" | "unsupported" | "failed" | "lost"

const ReadyContext = createContext<() => void>(() => undefined)

/** For the scene: call it once the first frame is drawn, and the frame lifts its placeholder. */
export function useSceneReady() {
  return useContext(ReadyContext)
}

let webgl: boolean | undefined

/** Whether this browser can make the WebGL 2 context that three.js needs. Asked once, and the test context is let go at once. */
function hasWebgl(): boolean {
  if (webgl === undefined) {
    const gl = document.createElement("canvas").getContext("webgl2")
    webgl = gl !== null
    gl?.getExtension("WEBGL_lose_context")?.loseContext()
  }
  return webgl
}

/** Tells the frame when the scene under it threw, and draws nothing then (the frame draws the words). */
class Boundary extends Component<{ onFailed: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    this.props.onFailed()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

function Message({ children }: { children: ReactNode }) {
  return <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-sm text-muted-foreground">{children}</div>
}

/**
 * A scene and its controls in one box. `label` says what the scene shows (it is the scene's accessible name, and the text of the fallback); `controls` sit under the scene and are the way to do with the keyboard everything the scene lets
 * a pointer do. `tall` gives the box more height, for a scene that has a great deal on its table. `fill` makes it the whole of the room its parent gives it, with no border and no fixed ratio: a scene that is a page of its own.
 */
export function SceneFrame({ label, controls, tall = false, fill = false, children }: { label: string; controls?: ReactNode; tall?: boolean; fill?: boolean; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<Mode>("idle")
  const [ready, setReady] = useState(false)
  const markReady = useCallback(() => setReady(true), [])

  useEffect(() => {
    const node = box.current
    if (!node) return
    const start = () => setMode(hasWebgl() ? "live" : "unsupported")
    const stopped = () => {
      setMode((current) => (current === "live" ? "lost" : current))
      setReady(false)
    }
    node.addEventListener("webglcontextlost", stopped, true)
    if (typeof IntersectionObserver === "undefined") {
      const timer = setTimeout(start, 0)
      return () => {
        clearTimeout(timer)
        node.removeEventListener("webglcontextlost", stopped, true)
      }
    }
    let letGo: ReturnType<typeof setTimeout> | undefined
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1]
        if (!entry) return
        clearTimeout(letGo)
        if (entry.isIntersecting) {
          setMode((current) => (current === "idle" ? (hasWebgl() ? "live" : "unsupported") : current))
        } else {
          letGo = setTimeout(() => {
            setMode((current) => (current === "live" || current === "lost" || current === "failed" ? "idle" : current))
            setReady(false)
          }, LET_GO_AFTER)
        }
      },
      { rootMargin: NEAR },
    )
    observer.observe(node)
    return () => {
      clearTimeout(letGo)
      observer.disconnect()
      node.removeEventListener("webglcontextlost", stopped, true)
    }
  }, [])

  const live = mode === "live"
  const spoken = mode === "unsupported" || mode === "failed" || mode === "lost"
  return (
    <div data-slot="scene-specimen" className={cn("flex flex-col overflow-hidden", fill ? "h-full" : "rounded-3xl border")}>
      <div
        ref={box}
        role={spoken ? undefined : "img"}
        aria-label={spoken ? undefined : label}
        aria-busy={live && !ready}
        className={cn("relative w-full overflow-hidden bg-card [&_canvas]:touch-pan-y", fill ? "h-full min-h-0 flex-1" : tall ? "aspect-square sm:aspect-16/10" : "aspect-4/3 sm:aspect-video")}
      >
        {live && (
          <Boundary
            onFailed={() => {
              setMode("failed")
              setReady(false)
            }}
          >
            <ReadyContext.Provider value={markReady}>
              <div className="absolute inset-0">{children}</div>
            </ReadyContext.Provider>
          </Boundary>
        )}
        <div aria-hidden className={cn("pointer-events-none absolute inset-0 bg-card transition-opacity duration-slow", live && ready ? "opacity-0" : "opacity-100", live && !ready && "motion-safe:animate-pulse")} />
        {mode === "unsupported" && <Message>This scene needs WebGL, which this browser does not provide. It shows: {label}.</Message>}
        {mode === "failed" && <Message>The scene could not start in this browser. It shows: {label}.</Message>}
        {mode === "lost" && (
          <Message>
            <span>The graphics context stopped, as a browser does when a page asks too much of it.</span>
            <Button variant="outline" size="sm" onClick={() => setMode("live")}>
              Start the scene again
            </Button>
          </Message>
        )}
      </div>
      {controls && <div className="flex flex-wrap items-end gap-x-8 gap-y-5 border-t p-4 sm:p-6">{controls}</div>}
    </div>
  )
}
