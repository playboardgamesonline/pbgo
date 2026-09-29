import type { Metadata, Viewport } from "next";
import { site } from "./site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: site.title,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  keywords: [
    "Hanabi",
    "Hanabi en ligne",
    "jeu coopératif",
    "jeu de cartes",
    "feux d'artifice",
    "Antoine Bauza",
    "jeu de société en ligne",
    "jouer entre amis",
  ],
  authors: [{ name: "Oré" }],
  creator: "Oré",
  category: "games",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: site.name,
    title: site.title,
    description: site.description,
    locale: site.locale,
  },
  twitter: {
    card: "summary_large_image",
    title: site.title,
    description: site.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "NNqyjwU_KDPRURSnEMUynx4l6Vrl_ELFzR99g8dBudQ",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: site.themeColor,
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
