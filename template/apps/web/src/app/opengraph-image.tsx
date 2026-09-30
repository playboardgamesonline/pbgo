import { renderShareImage } from "@pbgo/core/metadata/images"
import { NAME } from "@/lib/site"

// Image de partage : envoyée dans l'admin (Identity), sinon composée avec l'habillage (Visual)
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = NAME
export const revalidate = 300

export default function OpengraphImage() {
  return renderShareImage()
}
