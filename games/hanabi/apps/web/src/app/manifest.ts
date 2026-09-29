import { createManifest } from "@pgo/site"
import { SITE } from "@/lib/site"

export default function manifest() {
  return createManifest(SITE)
}
