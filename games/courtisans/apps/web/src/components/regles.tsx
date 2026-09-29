"use client"

import { CrownIcon, HourglassIcon, PlayIcon, ScrollTextIcon, SwordsIcon, TrophyIcon } from "lucide-react"
import { CatalogueIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { type ContenuRegles, REGLES_PAR_DEFAUT, type RoleRegles } from "@/lib/catalogue"
import { cn } from "@/lib/utils"

export const BOUTON_ICONE =
  "size-11 cursor-pointer rounded-full bg-transparent text-foreground transition-transform hover:scale-110 hover:bg-transparent hover:text-foreground active:scale-95 dark:hover:bg-transparent"

const ONGLETS = [
  { cle: "but", titre: "goalTitle", icone: CrownIcon },
  { cle: "deroulement", titre: "flowTitle", icone: HourglassIcon },
  { cle: "tour", titre: "turnTitle", icone: ScrollTextIcon },
  { cle: "roles", titre: "rolesTitle", icone: SwordsIcon },
  { cle: "fin", titre: "scoringTitle", icone: TrophyIcon },
] as const
const VIDEO = { cle: "video", titre: "videoTitle", icone: PlayIcon } as const
type Onglet = (typeof ONGLETS)[number]["cle"] | "video"

function Etiquette({ type }: { type: "lumiere" | "disgrace" | "neutre" }) {
  const styles = {
    lumiere: "bg-[#f6e7b8] text-[#8a5a12] ring-[#d9a93f]/70",
    disgrace: "bg-[#12322f] text-[#e7c46a] ring-[#d9a93f]/50",
    neutre: "bg-[#7b8384] text-white ring-[#9aa1a2]",
  }
  const texte = { lumiere: "dans la lumière", disgrace: "en disgrâce", neutre: "neutre" }
  return <span className={cn("rounded-md px-1.5 py-px text-[0.92em] whitespace-nowrap ring-1", styles[type])}>{texte[type]}</span>
}

function Riche({ texte }: { texte: string }) {
  const paragraphes = texte.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  if (paragraphes.length > 1)
    return (
      <>
        {paragraphes.map((p, i) => (
          <span key={i} className={cn("block", i > 0 && "mt-[0.7em]")}>
            <Ligne texte={p} />
          </span>
        ))}
      </>
    )
  return <Ligne texte={texte.trim()} />
}

function Ligne({ texte }: { texte: string }) {
  return (
    <>
      {texte.split(/(\{lumiere\}|\{disgrace\}|\{neutre\}|\*\*[^*]+\*\*)/).map((morceau, i) => {
        if (morceau === "{lumiere}") return <Etiquette key={i} type="lumiere" />
        if (morceau === "{disgrace}") return <Etiquette key={i} type="disgrace" />
        if (morceau === "{neutre}") return <Etiquette key={i} type="neutre" />
        if (morceau.startsWith("**") && morceau.endsWith("**")) return <strong key={i}>{morceau.slice(2, -2)}</strong>
        return morceau.split("\n").flatMap((l, j) => (j ? [<br key={`${i}-${j}`} />, l] : [l]))
      })}
    </>
  )
}

function EnTete({ titre, children }: { titre: string; children?: React.ReactNode }) {
  return (
    <header className="mb-8 max-w-4xl">
      <h3 className="font-display text-4xl tracking-[0.04em] text-[#0e3940] uppercase">{titre}</h3>
      {children && <div className="mt-3 text-lg leading-[1.45] text-[#1f2b2d]/80">{children}</div>}
    </header>
  )
}

function Carte({ numero, titre, sous, children }: { numero?: number; titre: string; sous?: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-[#0e3940]/15 pt-4">
      <div className="flex items-center gap-3">
        {numero !== undefined && (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#0e3940] font-display text-sm text-[#f6e7b8]">
            {numero}
          </span>
        )}
        <div>
          <p className="font-display text-lg text-[#0e3940]">{titre}</p>
          {sous && <p className="text-sm text-[#1f2b2d]/55 italic">{sous}</p>}
        </div>
      </div>
      <div className="mt-2 leading-[1.45] text-[#1f2b2d]/85">{children}</div>
    </div>
  )
}

function urlMasque(src: string) {
  return /^https:\/\/cdn\.sanity\.io\//.test(src) ? `/api/media?url=${encodeURIComponent(src)}` : src
}

function Picto({ src, cadre, className }: { src: string | null; cadre: string; className?: string }) {
  return (
    <div aria-hidden className={cn("relative size-14 shrink-0", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cadre} alt="" className="absolute inset-0 size-full" />
      {src && (
        <span
          className="absolute inset-[27%] bg-[#e7c46a]"
          style={{
            maskImage: `url("${urlMasque(src)}")`,
            WebkitMaskImage: `url("${urlMasque(src)}")`,
            maskSize: "contain",
            WebkitMaskSize: "contain",
            maskRepeat: "no-repeat",
            WebkitMaskRepeat: "no-repeat",
            maskPosition: "center",
            WebkitMaskPosition: "center",
          }}
        />
      )}
    </div>
  )
}

function ImageCarte({ src, className }: { src: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" draggable={false} className={cn("absolute h-auto shadow-[0_10px_24px_rgb(14_57_64/30%)]", className)} />
  )
}

function Role({ role, cadre, children }: { role: RoleRegles; cadre: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-6 border-t border-[#0e3940]/15 pt-5">
      <div aria-hidden className="relative h-[10rem] w-[7.6rem] shrink-0">
        <ImageCarte src={role.cartes[0]} className="top-0 left-0 w-[4.8rem] -rotate-[8deg] rounded-md" />
        <ImageCarte src={role.cartes[1]} className="top-[1.1rem] left-[2.7rem] w-[4.8rem] rotate-[5deg] rounded-md" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Picto src={role.pictoUrl} cadre={cadre} />
          {role.letteringUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={role.letteringUrl} alt={role.nom} className="h-9 w-auto" />
          ) : (
            <p className="font-display text-2xl text-[#0e3940]">{role.nom}</p>
          )}
          <span className="font-display text-xl whitespace-nowrap text-[#0e3940]">
            × {role.nombre} <span className="text-base text-[#0e3940]/70">par famille</span>
          </span>
        </div>
        <div className="mt-2 leading-[1.45] text-[#1f2b2d]/85">{children}</div>
      </div>
    </div>
  )
}

const ORDRE_ROLES = ["noble", "garde", "espion", "assassin"] as const

function Contenu({ onglet, regles }: { onglet: Onglet; regles: ContenuRegles }) {
  const t = regles.textes
  switch (onglet) {
    case "video":
      return (
        <>
          <EnTete titre={t.videoTitle} />
          <div className="overflow-hidden rounded-2xl bg-black shadow-[0_16px_40px_rgb(14_57_64/30%)]">
            <iframe
              className="aspect-video w-full"
              src={`https://www.youtube-nocookie.com/embed/${t.videoId}?rel=0`}
              title="Courtisans – règles en vidéo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </>
      )
    case "but":
      return (
        <>
          <EnTete titre={t.goalTitle}>
            <Riche texte={t.goalIntro} />
          </EnTete>
          <Carte titre="Six familles">
            <Riche texte={t.goalFamilies} />
          </Carte>
          <div className="mt-6 grid grid-cols-3 gap-x-6 gap-y-10 sm:grid-cols-6">
            {regles.familles.map((f, i) => (
              <div key={f.cle} className="flex flex-col items-center">
                <div className="relative w-full max-w-[7.5rem]" style={{ rotate: `${i % 2 ? 2 : -2}deg` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.carteUrl}
                    alt=""
                    draggable={false}
                    className="aspect-[472/890] w-full rounded-lg object-cover shadow-[0_10px_24px_rgb(14_57_64/30%)]"
                  />
                  <Picto src={f.pictoUrl} cadre={regles.cadrePicto} className="absolute -bottom-6 left-1/2 size-12 -translate-x-1/2" />
                </div>
                <p className="mt-8 font-display text-lg tracking-[0.08em] text-[#0e3940] uppercase">{f.nom}</p>
                <span aria-hidden className="mt-1 h-1 w-8 rounded-full" style={{ backgroundColor: f.couleur }} />
              </div>
            ))}
          </div>
          <div className="mt-12 grid items-center gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_auto]">
            <Carte titre="Deux missions secrètes">
              <Riche texte={t.goalMissions} />
            </Carte>
            <div aria-hidden className="relative mx-auto h-[15.5rem] w-[22rem]">
              <ImageCarte src={regles.missions[0]} className="top-0 left-0 w-[16.5rem] -rotate-[5deg] rounded-xl" />
              <ImageCarte src={regles.missions[1]} className="right-0 bottom-0 w-[16.5rem] rotate-[4deg] rounded-xl" />
            </div>
          </div>
        </>
      )
    case "deroulement":
      return (
        <>
          <EnTete titre={t.flowTitle}>
            <Riche texte={t.flowIntro} />
          </EnTete>
          <div className="grid max-w-4xl gap-y-6">
            <Carte numero={1} titre="Le tapis et la pioche">
              <Riche texte={t.flowMat} />
            </Carte>
            <Carte numero={2} titre="Votre main">
              <Riche texte={t.flowHand} />
            </Carte>
            <Carte numero={3} titre="Vos missions">
              <Riche texte={t.flowMissions} />
            </Carte>
          </div>
          <div className="mt-6 flex max-w-4xl items-center gap-4 rounded-2xl bg-[#0e3940] px-6 py-4 text-[#f3ecd6]">
            <CrownIcon className="size-6 shrink-0 text-[#e7c46a]" />
            <div>
              <Riche texte={t.flowStart} />
            </div>
          </div>
        </>
      )
    case "tour":
      return (
        <>
          <EnTete titre={t.turnTitle}>
            <Riche texte={t.turnIntro} />
          </EnTete>
          <div className="grid max-w-4xl gap-y-6">
            <Carte numero={1} titre="À la table de la reine" sous="autour du tapis">
              <Riche texte={t.turnTable} />
            </Carte>
            <Carte numero={2} titre="Dans votre domaine" sous="devant vous">
              <Riche texte={t.turnDomain} />
            </Carte>
            <Carte numero={3} titre="Dans un domaine adverse" sous="devant l'adversaire de votre choix">
              <Riche texte={t.turnOpponent} />
            </Carte>
          </div>
          <div className="mt-6 flex max-w-4xl items-center gap-4 rounded-2xl bg-[#0e3940] px-6 py-4 text-[#f3ecd6]">
            <ScrollTextIcon className="size-6 shrink-0 text-[#e7c46a]" />
            <div>
              <strong className="font-display text-[#f6e7b8]">Fin du tour</strong> — <Riche texte={t.turnEnd} />
            </div>
          </div>
        </>
      )
    case "roles":
      return (
        <>
          <EnTete titre={t.rolesTitle}>
            <Riche texte={t.rolesIntro} />
          </EnTete>
          <div className="grid max-w-4xl gap-y-6">
            {ORDRE_ROLES.map((cle) => (
              <Role key={cle} role={regles.roles[cle]} cadre={regles.cadrePicto}>
                <Riche texte={regles.roles[cle].texte} />
              </Role>
            ))}
          </div>
        </>
      )
    case "fin":
      return (
        <>
          <EnTete titre={t.scoringTitle}>
            <Riche texte={t.scoringIntro} />
          </EnTete>
          <div className="grid gap-x-8 gap-y-8 lg:grid-cols-3">
            <Carte numero={1} titre="Les espions sont révélés">
              <Riche texte={t.scoringReveal} />
            </Carte>
            <Carte numero={2} titre="Le statut des familles">
              <Riche texte={t.scoringStatus} />
            </Carte>
            <Carte numero={3} titre="Les points">
              <Riche texte={t.scoringPoints} />
            </Carte>
          </div>
        </>
      )
  }
}

function BoutonOnglet({ onglet, actif, nom, onClick }: { onglet: { icone: typeof PlayIcon }; actif: boolean; nom: string; onClick: () => void }) {
  const Icone = onglet.icone
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left font-display text-[1.05rem] whitespace-nowrap transition-colors",
        actif ? "text-[#0e3940]" : "text-[#f3ecd6]/75 hover:text-[#f6e7b8]",
      )}
    >
      {actif && (
        <motion.span
          layoutId="onglet-regles"
          className="absolute inset-0 rounded-xl bg-[#f3ecd6]"
          transition={{ type: "spring", stiffness: 400, damping: 34 }}
        />
      )}
      <Icone className="relative size-5" strokeWidth={1.6} />
      <span className="relative">{nom}</span>
    </button>
  )
}

export function ReglesButton({ className, icone, regles = REGLES_PAR_DEFAUT }: { className?: string; icone?: boolean; regles?: ContenuRegles }) {
  const [onglet, setOnglet] = useState<Onglet>("but")
  return (
    <Dialog>
      <DialogTrigger asChild>
        {icone ? (
          <Button variant="ghost" size="icon" aria-label="Règles du jeu" title="Règles du jeu" className={cn(BOUTON_ICONE, className)}>
            <HugeiconsIcon icon={CatalogueIcon} strokeWidth={1.6} className="size-7 drop-shadow-[0_1px_3px_rgb(0_0_0/60%)]" />
          </Button>
        ) : (
          <Button variant="outline" className={className}>
            <HugeiconsIcon icon={CatalogueIcon} />
            Règles du jeu
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex h-[86vh] w-[min(95vw,92rem)] max-w-none gap-0 overflow-hidden rounded-3xl border-0 bg-[#f3ecd6] p-0 text-[#1f2b2d] shadow-[0_30px_80px_rgb(0_0_0/55%)] sm:max-w-none">
        <nav className="relative flex w-80 shrink-0 flex-col bg-[#0e3940] px-4 py-7 text-[#f3ecd6]">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-(image:--image-motif) bg-[length:110px_110px] opacity-[0.06]" />
          <div className="relative px-3 pb-8">
            <DialogTitle className="font-display text-2xl text-[#f6e7b8]">Règles du jeu</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-[#f3ecd6]/60">2 à 5 joueurs · 30 minutes</DialogDescription>
          </div>
          <ul className="relative space-y-1">
            {ONGLETS.map((o) => (
              <li key={o.cle}>
                <BoutonOnglet onglet={o} actif={onglet === o.cle} nom={regles.textes[o.titre]} onClick={() => setOnglet(o.cle)} />
              </li>
            ))}
          </ul>
          <div className="relative mt-auto border-t border-[#f3ecd6]/15 pt-4">
            <BoutonOnglet onglet={VIDEO} actif={onglet === "video"} nom={regles.textes.videoTitle} onClick={() => setOnglet("video")} />
          </div>
        </nav>
        <div className="relative flex min-w-0 flex-1">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-(image:--image-papier) bg-cover bg-center opacity-45 mix-blend-multiply"
          />
          <ScrollArea className="relative min-w-0 flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={onglet}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="px-10 py-10"
              >
                <Contenu onglet={onglet} regles={regles} />
              </motion.div>
            </AnimatePresence>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
