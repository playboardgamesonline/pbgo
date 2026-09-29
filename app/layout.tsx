import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hanabi — en ligne",
  description: "Hanabi, le jeu coopératif d'Antoine Bauza, bientôt jouable en ligne.",
};

export const viewport: Viewport = {
  themeColor: "#101b3e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
