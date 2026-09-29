import type { MetadataRoute } from "next";
import { site } from "./site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.title,
    short_name: "Hanabi",
    description: site.description,
    start_url: "/",
    display: "standalone",
    lang: "fr",
    background_color: site.themeColor,
    theme_color: site.themeColor,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
