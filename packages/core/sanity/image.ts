import { createImageUrlBuilder, type SanityImageSource } from "@sanity/image-url"
import { dataset, projectId } from "./env"

const builder = createImageUrlBuilder({ projectId, dataset })

export function urlFor(source: SanityImageSource) {
  return builder.image(source).auto("format")
}

/** Sans conversion automatique (partage, favicon) : le format demandé est servi tel quel, même aux navigateurs qui acceptent WebP. */
export function fixedUrlFor(source: SanityImageSource) {
  return builder.image(source)
}
