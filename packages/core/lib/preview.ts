import type { SiteSettings } from "./settings"
import type { Skin } from "./skin"
import { withBase } from "./base-path"

/** Aperçus de l'admin : pages /preview/* affichées dans une iframe, qui reçoivent le brouillon par postMessage. */
export const PREVIEW_MESSAGE = "pbgo:preview-draft"
export const PREVIEW_READY = "pbgo:preview-ready"

export type PreviewDraft = { settings?: SiteSettings; skin?: Skin }

export const isPreviewWindow = () =>
  typeof window !== "undefined" && window.self !== window.top && window.location.pathname.startsWith(withBase("/preview"))
