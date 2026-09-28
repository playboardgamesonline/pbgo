import type { MetadataRoute } from "next"
import { DESCRIPTION } from "@/lib/site"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Courtisans",
    short_name: "Courtisans",
    description: DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#0e3940",
    theme_color: "#0e3940",
    lang: "fr",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  }
}
