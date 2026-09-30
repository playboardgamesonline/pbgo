import { createMetadata, createViewport } from "@pbgo/site"
import { SITE } from "@/lib/site"
import "./globals.css"

export const metadata = createMetadata(SITE)

export const viewport = createViewport(SITE)

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
