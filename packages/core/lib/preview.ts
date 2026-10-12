import type { SiteSettings } from "./settings"
import type { Skin } from "./skin"

/** Admin previews: `/<slug>/preview/*` pages shown in an iframe, which receive the draft through postMessage. */
export const PREVIEW_MESSAGE = "pbgo:preview-draft"
export const PREVIEW_READY = "pbgo:preview-ready"

export type PreviewDraft = { settings?: SiteSettings; skin?: Skin }

/** Path of a game's preview page (`/<slug>/preview` or below). */
export const PREVIEW_PATH = /^\/[^/]+\/preview(\/|$)/

export const isPreviewWindow = () =>
  typeof window !== "undefined" && window.self !== window.top && PREVIEW_PATH.test(window.location.pathname)
