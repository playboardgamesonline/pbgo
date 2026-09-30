"use client"

import { useEffect, useState } from "react"
import { isPreviewWindow, PREVIEW_MESSAGE, PREVIEW_READY, type PreviewDraft } from "../lib/preview"
import { fontFaceCss, googleFontsHref, themeStyle } from "../lib/settings"

/** Dans l'iframe d'aperçu de l'admin : reçoit le brouillon (réglages + habillage) et l'applique sans enregistrer. */
export function usePreviewDraft(): PreviewDraft | null {
  const [draft, setDraft] = useState<PreviewDraft | null>(null)
  useEffect(() => {
    if (!isPreviewWindow()) return
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin || e.data?.type !== PREVIEW_MESSAGE) return
      setDraft(e.data.draft as PreviewDraft)
    }
    window.addEventListener("message", onMessage)
    window.parent.postMessage({ type: PREVIEW_READY }, window.location.origin)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  const settings = draft?.settings
  useEffect(() => {
    if (!settings) return
    const root = document.documentElement
    for (const [k, v] of Object.entries(themeStyle(settings))) root.style.setProperty(k, v)
    const nodes: HTMLElement[] = []
    const href = googleFontsHref([settings.files.fontBody ? null : settings.bodyFont, settings.files.fontDisplay ? null : settings.displayFont])
    if (href) {
      const link = document.createElement("link")
      link.rel = "stylesheet"
      link.href = href
      nodes.push(link)
    }
    const faces = fontFaceCss(settings.files)
    if (faces) {
      const style = document.createElement("style")
      style.textContent = faces
      nodes.push(style)
    }
    nodes.forEach((n) => document.head.appendChild(n))
    return () => nodes.forEach((n) => n.remove())
  }, [settings])

  return draft
}
