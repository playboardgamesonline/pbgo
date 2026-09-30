import { renderShareImage } from "@pgo/core/metadata/images"
import { siteTitle } from "@pgo/core/lib/settings"
import { NAME } from "@/lib/site"

// Image de partage : envoyée dans l'admin (Identity), sinon composée avec l'habillage (Visual)
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = siteTitle(NAME)
export const revalidate = 300

export default function OpengraphImage() {
  return renderShareImage()
}
