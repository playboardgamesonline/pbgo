import type { Metadata } from "next"
import localFont from "next/font/local"
import "@fontsource-variable/alegreya"
import { EcranOrdinateur } from "@/components/ecran-ordinateur"
import { MoteurSon } from "@/components/son"
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
  title: "Courtisans",
  description: "Jouez à Courtisans en ligne avec vos amis",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${typey.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Toaster position="top-center" />
        <EcranOrdinateur />
        <MoteurSon />
      </body>
    </html>
  )
}
