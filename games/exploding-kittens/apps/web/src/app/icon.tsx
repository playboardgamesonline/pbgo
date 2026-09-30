import { renderIcon } from "@pbgo/core/metadata/images"

// Favicon : envoyé dans l'admin (Identity), sinon fait à partir du logo
export const size = { width: 64, height: 64 }
export const contentType = "image/png"
export const revalidate = 300

export default function Icon() {
  return renderIcon(64)
}
