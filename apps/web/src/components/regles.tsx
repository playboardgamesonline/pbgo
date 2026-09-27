"use client"

import { BookOpenIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export const BOUTON_ICONE =
  "size-11 cursor-pointer rounded-full bg-transparent text-foreground transition-transform hover:scale-110 hover:bg-transparent hover:text-foreground active:scale-95 dark:hover:bg-transparent"

const VIDEO = "ClROWcPTZHk"

function Titre({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="flex items-center justify-center gap-3 text-center font-display text-2xl tracking-wide text-[#b8862b] uppercase">
      <span aria-hidden className="h-px w-10 bg-gradient-to-r from-transparent to-[#b8862b]" />
      {children}
      <span aria-hidden className="h-px w-10 bg-gradient-to-l from-transparent to-[#b8862b]" />
    </h3>
  )
}

function Section({ titre, children, className }: { titre: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-4", className)}>
      <Titre>{titre}</Titre>
      <div className="space-y-3 text-[1.02rem] leading-relaxed">{children}</div>
    </section>
  )
}

function Encart({ titre, sous, children }: { titre: string; sous: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-[#c99a3b]/70 bg-[#0e5a5f] p-4 text-[#f3ecd6] shadow-inner">
      <p className="text-center font-display text-lg tracking-wide text-[#f6e7b8] uppercase">✦ {titre} ✦</p>
      <p className="mb-2 text-center text-sm text-[#f3ecd6]/70 italic">({sous})</p>
      <div className="text-[0.98rem] leading-relaxed">{children}</div>
    </div>
  )
}

function Etiquette({ type }: { type: "lumiere" | "disgrace" | "neutre" }) {
  const styles = {
    lumiere: "bg-[#f6e7b8] text-[#8a5a12] border-[#d9a93f]",
    disgrace: "bg-[#12322f] text-[#e7c46a] border-[#d9a93f]",
    neutre: "bg-[#7b8384] text-white border-[#9aa1a2]",
  }
  const texte = { lumiere: "dans la lumière", disgrace: "en disgrâce", neutre: "neutre" }
  return <span className={cn("rounded-md border px-1.5 py-px text-[0.92em] whitespace-nowrap", styles[type])}>{texte[type]}</span>
}

function Illustration({ src, alt, className }: { src: string; alt: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" className={cn("mx-auto rounded-xl shadow-[0_8px_24px_rgb(0_0_0/25%)]", className)} />
}

function Role({ nom, nombre, image, children }: { nom: string; nombre: number; image: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt={nom} loading="lazy" className="w-24 shrink-0 drop-shadow-[0_6px_10px_rgb(0_0_0/30%)]" />
      <div>
        <p className="font-display text-xl text-[#0e3940]">
          {nom} <span className="text-sm text-[#0e3940]/60 italic">× {nombre} par famille</span>
        </p>
        <div className="text-[0.98rem] leading-relaxed">{children}</div>
      </div>
    </div>
  )
}

export function ReglesButton({ className, icone }: { className?: string; icone?: boolean }) {
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
      <DialogContent className="max-h-[90vh] gap-0 overflow-hidden bg-[#f3ecd6] p-0 text-[#1f2b2d] sm:max-w-4xl">
        <DialogHeader className="border-b border-[#c99a3b]/40 px-8 pt-6 pb-4">
          <DialogTitle className="text-center font-display text-3xl text-[#0e3940]">Règles de Courtisans</DialogTitle>
          <DialogDescription className="text-center text-[#1f2b2d]/65">2 à 5 joueurs · environ 30 minutes</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-6.5rem)]">
          <div className="space-y-12 px-8 py-8">
            <section className="space-y-3">
              <Titre>Les règles en vidéo</Titre>
              <div className="overflow-hidden rounded-xl shadow-[0_8px_24px_rgb(0_0_0/25%)]">
                <iframe
                  className="aspect-video w-full"
                  src={`https://www.youtube-nocookie.com/embed/${VIDEO}?rel=0`}
                  title="Courtisans – règles en vidéo"
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </section>

            <Section titre="Présentation et but du jeu">
              <p>
                Dans Courtisans, vous recevez et jouez 3 cartes à chacun de vos tours. L&apos;une d&apos;elles est jouée à la table de la reine, pour
                influencer positivement ou négativement le statut d&apos;une famille. Les deux autres sont jouées chez vous et chez un adversaire et
                font gagner ou perdre des points, en fonction du statut de leur famille. Choisissez bien comment répartir vos 3 cartes si vous
                souhaitez terminer la partie avec le plus de points et l&apos;emporter.
              </p>
            </Section>

            <Section titre="Matériel et mise en place">
              <div className="grid items-center gap-6 md:grid-cols-[1fr_1.1fr]">
                <Illustration src="/regles/materiel.webp" alt="90 cartes Courtisan, 20 cartes Mission et 1 tapis de jeu" />
                <div className="space-y-3">
                  <p>Les cartes Courtisan sont mélangées, puis certaines sont écartées au hasard selon le nombre de joueurs :</p>
                  <ul className="space-y-1 text-center font-display text-[#8a5a12]">
                    <li>À 2 joueurs, 30 cartes écartées (60 dans la pioche)</li>
                    <li>À 3 joueurs, 18 cartes écartées (72 dans la pioche)</li>
                    <li>À 4 joueurs, 6 cartes écartées (84 dans la pioche)</li>
                    <li>À 5 joueurs, la pioche est complète</li>
                  </ul>
                  <p>
                    Chacun reçoit 3 cartes Courtisan et 2 cartes Mission secrètes, une blanche et une bleue. Vous pouvez consulter vos missions à tout
                    moment, sans jamais les dévoiler. Le premier joueur est tiré au sort. <strong>Le banquet peut commencer !</strong>
                  </p>
                </div>
              </div>
            </Section>

            <Section titre="Déroulement du tour">
              <p>
                À votre tour, vous devez jouer les 3 cartes de votre main, face visible, <strong>une dans chacune des 3 zones</strong>, dans
                l&apos;ordre de votre choix.
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                <Encart titre="À la table de la reine" sous="autour du tapis de jeu">
                  Posez la carte dans la colonne de sa famille, au-dessus ou au-dessous du tapis. Les familles avec une majorité de cartes au-dessus
                  seront <Etiquette type="lumiere" />, celles avec une majorité au-dessous seront <Etiquette type="disgrace" />.
                </Encart>
                <Encart titre="Dans votre domaine" sous="devant vous">
                  En fin de partie, chaque carte d&apos;une famille <Etiquette type="lumiere" /> vous fait gagner 1 point, chaque carte d&apos;une
                  famille <Etiquette type="disgrace" /> vous en fait perdre 1.
                </Encart>
                <Encart titre="Dans un domaine adverse" sous="devant l'adversaire de votre choix">
                  En fin de partie, chaque carte d&apos;une famille <Etiquette type="lumiere" /> lui fait gagner 1 point, chaque carte d&apos;une
                  famille <Etiquette type="disgrace" /> lui en fait perdre 1.
                </Encart>
              </div>
              <Illustration
                src="/regles/table-exemple.webp"
                alt="Cartes posées au-dessus et au-dessous de la table de la reine"
                className="max-w-lg"
              />
              <p className="text-center">
                <strong>Fin du tour :</strong> piochez 3 nouvelles cartes. Si la pioche est vide, c&apos;était votre dernier tour.
              </p>
            </Section>

            <Section titre="Les rôles">
              <p>
                Certains courtisans ont un rôle, représenté sur l&apos;illustration par un objet et indiqué par une icône aux quatre coins de la
                carte.
              </p>
              <div className="grid gap-6 md:grid-cols-2">
                <Role nom="Noble" nombre={4} image="/regles/noble.webp">
                  En fin de partie, chaque noble compte pour 2 cartes, dans un domaine comme à la table de la reine.
                </Role>
                <Role nom="Garde" nombre={3} image="/regles/garde.webp">
                  Les gardes ne peuvent pas être éliminés par les assassins et ne quittent jamais le jeu.
                </Role>
                <Role nom="Espion" nombre={2} image="/regles/espion.webp">
                  Toujours joué face cachée : personne ne peut le regarder, pas même son propriétaire. À la table, il se place dans la colonne de la
                  reine, au-dessus ou au-dessous.
                </Role>
                <Role nom="Assassin" nombre={2} image="/regles/assassin.webp">
                  En le posant, vous pouvez éliminer n&apos;importe quelle autre carte de la même zone (sauf un garde), espions compris. Son pouvoir
                  est facultatif.
                </Role>
              </div>
              <div className="grid items-center gap-6 md:grid-cols-2">
                <figure className="space-y-2">
                  <Illustration src="/regles/espion-exemple.webp" alt="Un espion joué dans la colonne de la reine" />
                  <figcaption className="text-center text-sm text-[#0e5a5f] italic">
                    L&apos;espion rejoint la colonne de la reine, sans révéler sa famille.
                  </figcaption>
                </figure>
                <figure className="space-y-2">
                  <Illustration src="/regles/assassin-exemple.webp" alt="Un assassin élimine une noble à la table" className="max-w-xs" />
                  <figcaption className="text-center text-sm text-[#0e5a5f] italic">
                    Noëmie joue un assassin du rossignol au-dessous de la table et élimine une noble du lièvre au-dessus.
                  </figcaption>
                </figure>
              </div>
            </Section>

            <Section titre="Fin de partie et décompte">
              <p>
                La partie se termine lorsque la pioche est vide et que plus personne n&apos;a de cartes en main. Tous les espions sont révélés ; ceux
                de la table rejoignent la colonne de leur famille, sans changer de niveau.
              </p>
              <p>
                Les familles comptant plus de cartes au-dessus du tapis sont <Etiquette type="lumiere" />, celles ayant plus de cartes au-dessous sont{" "}
                <Etiquette type="disgrace" />, sinon elles sont <Etiquette type="neutre" />. Les nobles comptent pour deux cartes.
              </p>
              <Illustration src="/regles/decompte-table.webp" alt="Exemple de décompte à la table de la reine" className="max-w-lg" />
              <p>
                Chaque courtisan de votre domaine d&apos;une famille <Etiquette type="lumiere" /> rapporte 1 point, chaque courtisan d&apos;une
                famille <Etiquette type="disgrace" /> en fait perdre 1, les familles neutres ne comptent pas. Chaque mission réussie rapporte{" "}
                <strong>3 points</strong>. Le plus haut total l&apos;emporte ; les ex-aequo se partagent la victoire.
              </p>
              <figure className="space-y-2">
                <Illustration src="/regles/decompte-domaine.webp" alt="Exemple de décompte d'un domaine" className="max-w-lg" />
                <figcaption className="text-center text-sm text-[#0e5a5f] italic">
                  Noëmie totalise 11 points : +11 pour le papillon, le crapaud et le cerf, −3 pour le rossignol, 0 pour la carpe et +3 pour sa mission
                  réussie.
                </figcaption>
              </figure>
            </Section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
