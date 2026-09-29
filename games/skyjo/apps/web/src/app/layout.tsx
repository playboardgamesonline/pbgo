import type { Metadata, Viewport } from "next"
import { COULEUR, DESCRIPTION, MOTS_CLES, NOM, SITE_URL, TITRE } from "@/lib/site"
import "./globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITRE, template: `%s · ${TITRE}` },
  description: DESCRIPTION,
  applicationName: NOM,
  keywords: MOTS_CLES,
  authors: [{ name: "oré", url: "https://ore.today" }],
  creator: "oré",
  category: "games",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "/",
    siteName: TITRE,
    title: TITRE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: TITRE, description: DESCRIPTION },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  formatDetection: { telephone: false, email: false, address: false },
  verification: { google: "NNqyjwU_KDPRURSnEMUynx4l6Vrl_ELFzR99g8dBudQ" },
}

export const viewport: Viewport = { themeColor: COULEUR, colorScheme: "dark" }

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
