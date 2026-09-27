"use client"

import { BookOpenIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export const BOUTON_ICONE = "size-11 rounded-full border border-foreground/70 bg-transparent text-foreground hover:border-foreground hover:bg-foreground hover:text-[#0b2231]"

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="font-display text-lg text-[var(--disgrace)]">{titre}</h3>
      <div className="space-y-2 text-[0.95rem] leading-relaxed">{children}</div>
    </section>
  )
}

export function ReglesButton({ className, icone }: { className?: string; icone?: boolean }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {icone ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Règles du jeu"
            title="Règles du jeu"
            className={cn(BOUTON_ICONE, className)}
          >
            <BookOpenIcon strokeWidth={1.5} className="size-5" />
          </Button>
        ) : (
          <Button variant="outline" className={className}>
            <BookOpenIcon />
            Règles du jeu
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] gap-0 bg-popover p-0 text-popover-foreground sm:max-w-2xl">
        <DialogHeader className="border-b p-6">
          <DialogTitle className="font-display text-2xl">Règles de Courtisans</DialogTitle>
          <DialogDescription className="text-popover-foreground/70">2 à 5 joueurs · environ 30 minutes</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(85vh-6rem)]">
          <div className="space-y-6 p-6">
            <Section titre="But du jeu">
              <p>
                À chaque tour, vous jouez les 3 cartes de votre main : une à la table de la Reine pour faire briller ou disgracier une
                famille, une dans votre domaine et une dans le domaine d&apos;un adversaire. En fin de partie, le joueur avec le plus de
                points l&apos;emporte.
              </p>
            </Section>
            <Section titre="Mise en place">
              <p>Selon le nombre de joueurs, des cartes Courtisan sont écartées au hasard :</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>2 joueurs : 30 cartes écartées</li>
                <li>3 joueurs : 18 cartes écartées</li>
                <li>4 joueurs : 6 cartes écartées</li>
                <li>5 joueurs : aucune</li>
              </ul>
              <p>Chaque joueur reçoit 3 Courtisans et 2 Missions secrètes (une blanche, une bleue). Le premier joueur est tiré au sort.</p>
            </Section>
            <Section titre="Tour de jeu">
              <p>Jouez vos 3 cartes, dans l&apos;ordre de votre choix, une par zone :</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>À la table de la Reine</strong> : au-dessus ou au-dessous de la colonne de sa famille.
                </li>
                <li>
                  <strong>Dans votre domaine</strong> : devant vous.
                </li>
                <li>
                  <strong>Dans un domaine adverse</strong> : devant l&apos;adversaire de votre choix.
                </li>
              </ul>
              <p>Piochez ensuite 3 cartes. Si la pioche est vide, c&apos;était votre dernier tour.</p>
            </Section>
            <Section titre="Les rôles">
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>Noble</strong> (4 par famille) : compte pour 2 cartes, à la table comme dans un domaine.
                </li>
                <li>
                  <strong>Espion</strong> (2 par famille) : toujours joué face cachée, personne ne peut le regarder. À la table, il va dans
                  la colonne de la Reine.
                </li>
                <li>
                  <strong>Assassin</strong> (2 par famille) : en le posant, vous pouvez éliminer une autre carte de la même zone (à la
                  table : n&apos;importe quelle carte, espions compris). Facultatif.
                </li>
                <li>
                  <strong>Garde</strong> (3 par famille) : ne peut pas être éliminé.
                </li>
              </ul>
            </Section>
            <Section titre="Fin de partie et décompte">
              <p>
                Quand la pioche est vide et que plus personne n&apos;a de cartes, les espions sont révélés. Une famille avec plus de
                cartes au-dessus de la table est <strong>dans la lumière</strong>, avec plus de cartes au-dessous elle est{" "}
                <strong>en disgrâce</strong>, sinon elle est neutre (les nobles comptent double).
              </p>
              <p>
                Dans votre domaine, chaque carte d&apos;une famille dans la lumière rapporte 1 point, chaque carte d&apos;une famille en
                disgrâce en fait perdre 1. Chaque Mission réussie rapporte 3 points. En cas d&apos;égalité, les ex-aequo se partagent la
                victoire.
              </p>
            </Section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
