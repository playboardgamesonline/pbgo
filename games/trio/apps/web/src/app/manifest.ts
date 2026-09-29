import type { MetadataRoute } from "next"
import { COULEUR, DESCRIPTION, NOM, TITRE } from "@/lib/site"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: TITRE,
    short_name: NOM,
    description: DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: COULEUR,
    theme_color: COULEUR,
    lang: "fr",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  }
}
