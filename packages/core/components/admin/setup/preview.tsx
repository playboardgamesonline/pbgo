"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pgo/ui/admin/card"
import { Tabs, TabsList, TabsTrigger } from "@pgo/ui/admin/tabs"
import { PREVIEW_MESSAGE, PREVIEW_READY, type PreviewDraft } from "../../../lib/preview"

const FRAME = { width: 1440, height: 900 }

/** Vraie page du jeu (/preview/home ou /preview/game) dans une iframe réduite, qui reçoit le brouillon en direct. */
export function SiteFrame({ kind, draft }: { kind: "home" | "game"; draft: PreviewDraft }) {
  const box = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const [scale, setScale] = useState(0.25)
  const [ready, setReady] = useState(0)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setScale(entry!.contentRect.width / FRAME.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin === window.location.origin && e.data?.type === PREVIEW_READY && e.source === frame.current?.contentWindow) setReady((n) => n + 1)
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  useEffect(() => {
    if (!ready) return
    const id = setTimeout(() => frame.current?.contentWindow?.postMessage({ type: PREVIEW_MESSAGE, draft }, window.location.origin), 120)
    return () => clearTimeout(id)
  }, [draft, ready])

  return (
    <div ref={box} className="relative w-full overflow-hidden rounded-lg border bg-muted" style={{ height: FRAME.height * scale }}>
      <iframe
        ref={frame}
        key={kind}
        src={`/preview/${kind}`}
        title={kind === "home" ? "Home preview" : "In-game preview"}
        className="pointer-events-none absolute top-0 left-0 origin-top-left border-0"
        style={{ width: FRAME.width, height: FRAME.height, transform: `scale(${scale})` }}
        tabIndex={-1}
        aria-hidden
      />
    </div>
  )
}

export function PreviewCard({ draft, kinds = ["home"] }: { draft: PreviewDraft; kinds?: ("home" | "game")[] }) {
  const [kind, setKind] = useState(kinds[0]!)
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Preview</CardTitle>
        <CardDescription>Live, before saving</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {kinds.length > 1 && (
          <Tabs value={kind} onValueChange={(v) => setKind(v as "home" | "game")}>
            <TabsList className="w-full">
              {kinds.map((k) => (
                <TabsTrigger key={k} value={k}>
                  {k === "home" ? "Home" : "In game"}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
        <SiteFrame kind={kind} draft={draft} />
      </CardContent>
    </Card>
  )
}

/** Carte de lien partagé (iMessage, Discord, WhatsApp…) : image de partage, titre, description, domaine. */
export function LinkPreview({ image, title, description, domain }: { image: string; title: string; description: string; domain: string }) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Link preview</CardTitle>
        <CardDescription>When the site is shared</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-xl border bg-background shadow-xs">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" className="aspect-[1200/630] w-full bg-muted object-cover" />
          <div className="flex flex-col gap-0.5 p-3">
            <p className="text-xs text-muted-foreground uppercase">{domain}</p>
            <p className="line-clamp-1 text-sm font-semibold">{title || "Title"}</p>
            <p className="line-clamp-2 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
