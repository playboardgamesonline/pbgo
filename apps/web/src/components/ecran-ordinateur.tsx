import { MonitorIcon } from "lucide-react"

export function EcranOrdinateur() {
  return (
    <div className="fixed inset-0 z-[100] hidden flex-col items-center justify-center gap-6 bg-[#0e3940] px-8 text-center max-[899px]:flex">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[url(/accueil/motif.webp)] bg-[length:128px_128px] opacity-[0.07]" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.webp" alt="Courtisans" className="relative w-56" />
      <MonitorIcon className="relative size-14 text-primary" strokeWidth={1.3} />
      <p className="relative font-display text-2xl text-balance text-foreground">La cour vous attend sur grand écran</p>
      <p className="relative max-w-sm text-lg text-balance text-foreground/75">
        Courtisans se joue sur ordinateur. Ouvrez cette page depuis votre PC pour rejoindre le banquet de la Reine.
      </p>
    </div>
  )
}
