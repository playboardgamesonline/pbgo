import { renderIcon } from "@pbgo/core/metadata/images"

// Icône de l'écran d'accueil iOS : même source que le favicon
export const size = { width: 180, height: 180 }
export const contentType = "image/png"
export const revalidate = 300

export default function AppleIcon() {
  return renderIcon(180)
}
