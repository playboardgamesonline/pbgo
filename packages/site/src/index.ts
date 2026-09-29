import type { Metadata, MetadataRoute, Viewport } from "next"

export const GOOGLE_SITE_VERIFICATION = "NNqyjwU_KDPRURSnEMUynx4l6Vrl_ELFzR99g8dBudQ"
export const AUTHOR = { name: "oré", url: "https://ore.today" }

export type SiteConfig = {
  url: string
  name: string
  title: string
  tagline: string
  description: string
  keywords: string[]
  color: string
  colorScheme?: "dark" | "light"
  genre?: string[]
  playMode?: "MultiPlayer" | "CoOp" | "SinglePlayer"
  players?: { min: number; max: number }
}

export function createMetadata(site: SiteConfig): Metadata {
  return {
    metadataBase: new URL(site.url),
    title: { default: site.title, template: `%s · ${site.title}` },
    description: site.description,
    applicationName: site.name,
    keywords: site.keywords,
    authors: [AUTHOR],
    creator: AUTHOR.name,
    category: "games",
    alternates: { canonical: "/" },
    openGraph: { type: "website", locale: "fr_FR", url: "/", siteName: site.title, title: site.title, description: site.description },
    twitter: { card: "summary_large_image", title: site.title, description: site.description },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
    formatDetection: { telephone: false, email: false, address: false },
    verification: { google: GOOGLE_SITE_VERIFICATION },
  }
}

export function createViewport(site: Pick<SiteConfig, "color" | "colorScheme">): Viewport {
  return { themeColor: site.color, colorScheme: site.colorScheme ?? "dark" }
}

export function createRobots(url: string, disallow: string[] = ["/api/"]): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow }], sitemap: `${url}/sitemap.xml`, host: url }
}

export function createSitemap(url: string): MetadataRoute.Sitemap {
  return [{ url, changeFrequency: "weekly", priority: 1 }]
}

export function createManifest(site: Pick<SiteConfig, "name" | "title" | "description" | "color">): MetadataRoute.Manifest {
  return {
    name: site.title,
    short_name: site.name,
    description: site.description,
    start_url: "/",
    display: "standalone",
    background_color: site.color,
    theme_color: site.color,
    lang: "fr",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  }
}

export function gameJsonLd(site: SiteConfig) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${site.url}/#site`, url: site.url, name: site.title, inLanguage: "fr-FR", description: site.description },
      {
        "@type": "VideoGame",
        name: site.name,
        alternateName: site.title,
        url: site.url,
        description: site.description,
        inLanguage: "fr-FR",
        genre: site.genre ?? ["Jeu de cartes"],
        gamePlatform: "Navigateur web",
        applicationCategory: "Game",
        playMode: site.playMode ?? "MultiPlayer",
        ...(site.players ? { numberOfPlayers: { "@type": "QuantitativeValue", minValue: site.players.min, maxValue: site.players.max } } : {}),
        image: `${site.url}/opengraph-image.png`,
        offers: { "@type": "Offer", price: 0, priceCurrency: "EUR" },
        author: { "@type": "Person", ...AUTHOR },
      },
    ],
  }
}
