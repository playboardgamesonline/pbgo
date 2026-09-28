import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import "@fontsource-variable/alegreya"
import { EcranOrdinateur } from "@/components/ecran-ordinateur"
import { MoteurSon } from "@/components/son"
import { getCatalogueClient } from "@/sanity/catalogue-client"
import { DESCRIPTION, SITE_URL, TITRE } from "@/lib/site"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const typey = localFont({
  src: [
    { path: "../fonts/typey.woff2", style: "normal" },
    { path: "../fonts/typey-italic.woff2", style: "italic" },
  ],
  variable: "--police-typey",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITRE, template: "%s · Courtisans Online" },
  description: DESCRIPTION,
  applicationName: "Courtisans",
  keywords: [
    "Courtisans",
    "Courtisans en ligne",
    "jeu de cartes en ligne",
    "jeu de société en ligne",
    "jeu entre amis",
    "Catch Up Games",
    "banquet de la Reine",
    "jeu gratuit",
    "multijoueur",
  ],
  authors: [{ name: "oré", url: "https://ore.today" }],
  creator: "oré",
  category: "games",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "/",
    siteName: "Courtisans",
    title: TITRE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: TITRE, description: DESCRIPTION },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  formatDetection: { telephone: false, email: false, address: false },
}

export const viewport: Viewport = { themeColor: "#0e3940", colorScheme: "dark" }

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const catalogue = await getCatalogueClient()
  const images = { "--image-motif": `url("${catalogue.motifUrl}")`, "--image-papier": `url("${catalogue.papierUrl}")` } as React.CSSProperties
  return (
    <html lang="fr" className={`${typey.variable} h-full antialiased`} style={images}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Toaster position="top-center" />
        <EcranOrdinateur />
        <MoteurSon />
      </body>
    </html>
  )
}
