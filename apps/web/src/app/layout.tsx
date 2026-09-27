import type { Metadata } from "next"
import "@fontsource-variable/alegreya"
import "@fontsource-variable/cinzel"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

export const metadata: Metadata = {
  title: "Courtisans",
  description: "Jouez à Courtisans en ligne avec vos amis",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  )
}
