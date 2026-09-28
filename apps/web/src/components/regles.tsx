"use client"

import { BookOpenIcon, CrownIcon, PlayIcon, ScrollTextIcon, SwordsIcon, TrophyIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { type ContenuRegles, REGLES_PAR_DEFAUT } from "@/lib/catalogue"
import { cn } from "@/lib/utils"

export const BOUTON_ICONE =
  "size-11 cursor-pointer rounded-full bg-transparent text-foreground transition-transform hover:scale-110 hover:bg-transparent hover:text-foreground active:scale-95 dark:hover:bg-transparent"

const ONGLETS = [
  { cle: "video", nom: "Vidéo", icone: PlayIcon },
  { cle: "but", nom: "But du jeu", icone: CrownIcon },
  { cle: "tour", nom: "Tour de jeu", icone: ScrollTextIcon },
  { cle: "roles", nom: "Les rôles", icone: SwordsIcon },
  { cle: "fin", nom: "Décompte", icone: TrophyIcon },
] as const
type Onglet = (typeof ONGLETS)[number]["cle"]

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
  return (
    <>
      {texte.split(/(\{lumiere\}|\{disgrace\}|\{neutre\}|\*\*[^*]+\*\*)/).map((morceau, i) => {
        if (morceau === "{lumiere}") return <Etiquette key={i} type="lumiere" />
        if (morceau === "{disgrace}") return <Etiquette key={i} type="disgrace" />
        if (morceau === "{neutre}") return <Etiquette key={i} type="neutre" />
        if (morceau.startsWith("**") && morceau.endsWith("**")) return <strong key={i}>{morceau.slice(2, -2)}</strong>
        return morceau
      })}
    </>
  )
}

function Image({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  if (!src) return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" className={cn("rounded-xl shadow-[0_10px_30px_rgb(14_57_64/25%)]", className)} />
}

function EnTete({ surtitre, titre, children }: { surtitre: string; titre: string; children?: React.ReactNode }) {
  return (
    <header className="mb-8 max-w-2xl">
      <p className="text-xs font-semibold tracking-[0.25em] text-[#b8862b] uppercase">{surtitre}</p>
      <h3 className="mt-1 font-display text-4xl text-[#0e3940]">{titre}</h3>
      {children && <p className="mt-3 text-lg leading-relaxed text-[#1f2b2d]/80">{children}</p>}
    </header>
  )
}

function Carte({ numero, titre, sous, children }: { numero?: number; titre: string; sous?: string; children: React.ReactNode }) {
  return (
    <div className="relative rounded-2xl bg-white/70 p-5 shadow-[0_1px_0_rgb(255_255_255/80%)_inset,0_6px_20px_rgb(14_57_64/10%)] ring-1 ring-[#0e3940]/10">
      {numero !== undefined && (
        <span className="absolute -top-3 left-5 flex size-7 items-center justify-center rounded-full bg-[#0e3940] font-display text-sm text-[#f6e7b8] shadow">
          {numero}
        </span>
      )}
      <p className="font-display text-lg text-[#0e3940]">{titre}</p>
      {sous && <p className="text-sm text-[#1f2b2d]/55 italic">{sous}</p>}
      <div className="mt-2 leading-relaxed text-[#1f2b2d]/85">{children}</div>
    </div>
  )
}

function Role({
  nom,
  nombre,
  image,
  lettering,
  children,
}: {
  nom: string
  nombre: number
  image: string | null
  lettering: string | null
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-5 rounded-2xl bg-white/70 p-4 shadow-[0_6px_20px_rgb(14_57_64/10%)] ring-1 ring-[#0e3940]/10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {image && <img src={image} alt={nom} loading="lazy" className="w-24 shrink-0 self-center mix-blend-multiply" />}
      <div>
        <div className="flex items-baseline gap-2">
          {lettering ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lettering} alt={nom} className="h-9 w-auto" />
          ) : (
            <p className="font-display text-xl text-[#0e3940]">{nom}</p>
          )}
          <span className="rounded-full bg-[#0e3940]/8 px-2 py-0.5 text-xs text-[#0e3940]/70">{nombre} par famille</span>
        </div>
        <p className="mt-1.5 leading-relaxed text-[#1f2b2d]/85">{children}</p>
      </div>
    </div>
  )
}

const ORDRE_ROLES = ["noble", "garde", "espion", "assassin"] as const

function Contenu({ onglet, regles }: { onglet: Onglet; regles: ContenuRegles }) {
  const t = regles.textes
  const v = regles.visuels
  switch (onglet) {
    case "video":
      return (
        <>
          <EnTete surtitre="Découvrez" titre="Les règles en vidéo" />
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
          <EnTete surtitre="Présentation" titre="But du jeu">
            <Riche texte={t.goalIntro} />
          </EnTete>
          <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
            <Image src={v.tableVisual} alt="La table de la reine" />
            <div className="space-y-4">
              <Carte titre="Six familles">
                <Riche texte={t.goalFamilies} />
              </Carte>
              <Carte titre="Deux missions secrètes">
                <Riche texte={t.goalMissions} />
              </Carte>
              <Image src={v.missionsVisual} alt="Les cartes Mission" className="w-full" />
            </div>
          </div>
        </>
      )
    case "tour":
      return (
        <>
          <EnTete surtitre="Déroulement" titre="Votre tour de jeu">
            <Riche texte={t.turnIntro} />
          </EnTete>
          <div className="grid gap-5 lg:grid-cols-3">
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
          <div className="mt-6 flex items-center gap-4 rounded-2xl bg-[#0e3940] px-6 py-4 text-[#f3ecd6]">
            <ScrollTextIcon className="size-6 shrink-0 text-[#e7c46a]" />
            <p>
              <strong className="font-display text-[#f6e7b8]">Fin du tour</strong> — <Riche texte={t.turnEnd} />
            </p>
          </div>
        </>
      )
    case "roles":
      return (
        <>
          <EnTete surtitre="Pouvoirs" titre="Les rôles">
            <Riche texte={t.rolesIntro} />
          </EnTete>
          <div className="grid gap-4 lg:grid-cols-2">
            {ORDRE_ROLES.map((cle) => {
              const r = regles.roles[cle]
              return (
                <Role key={cle} nom={r.nom} nombre={r.nombre} image={r.visuelUrl} lettering={r.letteringUrl}>
                  <Riche texte={r.texte} />
                </Role>
              )
            })}
          </div>
          <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
            <figure className="space-y-2">
              <Image src={v.spyExample} alt="Un espion joué dans la colonne de la reine" className="w-full" />
              <figcaption className="text-sm text-[#0e5a5f] italic">{t.spyCaption}</figcaption>
            </figure>
            <figure className="space-y-2">
              <Image src={v.assassinExample} alt="Un assassin élimine une noble" className="mx-auto max-h-80" />
              <figcaption className="text-center text-sm text-[#0e5a5f] italic">{t.assassinCaption}</figcaption>
            </figure>
          </div>
        </>
      )
    case "fin":
      return (
        <>
          <EnTete surtitre="Fin de partie" titre="Le décompte">
            <Riche texte={t.scoringIntro} />
          </EnTete>
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-5">
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
            <div className="space-y-6">
              <Image src={v.scoringTable} alt="Exemple de statut des familles" className="w-full" />
              <figure className="space-y-2">
                <Image src={v.scoringDomain} alt="Exemple de décompte d'un domaine" className="w-full" />
                <figcaption className="text-sm text-[#0e5a5f] italic">{t.domainCaption}</figcaption>
              </figure>
            </div>
          </div>
        </>
      )
  }
}

export function ReglesButton({ className, icone, regles = REGLES_PAR_DEFAUT }: { className?: string; icone?: boolean; regles?: ContenuRegles }) {
  const [onglet, setOnglet] = useState<Onglet>("video")
  return (
    <Dialog>
      <DialogTrigger asChild>
        {icone ? (
          <Button variant="ghost" size="icon" aria-label="Règles du jeu" title="Règles du jeu" className={cn(BOUTON_ICONE, className)}>
            <BookOpenIcon strokeWidth={1.6} className="size-7 drop-shadow-[0_1px_3px_rgb(0_0_0/60%)]" />
          </Button>
        ) : (
          <Button variant="outline" className={className}>
            <BookOpenIcon />
            Règles du jeu
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex h-[86vh] w-[min(92vw,78rem)] max-w-none gap-0 overflow-hidden rounded-3xl border-0 bg-[#f3ecd6] p-0 text-[#1f2b2d] shadow-[0_30px_80px_rgb(0_0_0/55%)] sm:max-w-none">
        <nav className="relative flex w-64 shrink-0 flex-col bg-[#0e3940] px-4 py-7 text-[#f3ecd6]">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[url(/accueil/motif.webp)] bg-[length:110px_110px] opacity-[0.06]" />
          <div className="relative px-3 pb-8">
            <DialogTitle className="font-display text-2xl text-[#f6e7b8]">Règles du jeu</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-[#f3ecd6]/60">2 à 5 joueurs · 30 minutes</DialogDescription>
          </div>
          <ul className="relative space-y-1">
            {ONGLETS.map(({ cle, nom, icone: Icone }) => (
              <li key={cle}>
                <button
                  type="button"
                  onClick={() => setOnglet(cle)}
                  className={cn(
                    "relative flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left font-display text-[1.05rem] transition-colors",
                    onglet === cle ? "text-[#0e3940]" : "text-[#f3ecd6]/75 hover:text-[#f6e7b8]",
                  )}
                >
                  {onglet === cle && (
                    <motion.span
                      layoutId="onglet-regles"
                      className="absolute inset-0 rounded-xl bg-[#f3ecd6]"
                      transition={{ type: "spring", stiffness: 400, damping: 34 }}
                    />
                  )}
                  <Icone className="relative size-5" strokeWidth={1.6} />
                  <span className="relative">{nom}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <ScrollArea className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={onglet}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="px-12 py-12"
            >
              <Contenu onglet={onglet} regles={regles} />
            </motion.div>
          </AnimatePresence>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
