import { CHATEAUX_PAR_DEFAUT, type ChateauOption } from "@/lib/catalogue"
import { cn } from "@/lib/utils"

const VARIANTES: Record<string, { accent: string; donjon: boolean; toits: boolean }> = {
  "chateau-or": { accent: "var(--primary)", donjon: true, toits: false },
  "chateau-pourpre": { accent: "var(--famille-rossignol)", donjon: false, toits: true },
  "chateau-azur": { accent: "var(--famille-carpe)", donjon: true, toits: true },
  "chateau-sylve": { accent: "var(--famille-cerf)", donjon: false, toits: false },
  "chateau-ambre": { accent: "var(--famille-lievre)", donjon: true, toits: false },
}

function Creneaux({ x, y, largeur }: { x: number; y: number; largeur: number }) {
  const n = Math.max(2, Math.round(largeur / 6))
  const pas = largeur / n
  return (
    <>
      {Array.from({ length: n }, (_, i) => (i % 2 === 0 ? <rect key={i} x={x + i * pas} y={y - 4} width={pas} height={4} /> : null))}
    </>
  )
}

function Tour({ x, y, largeur, hauteur, toit, accent }: { x: number; y: number; largeur: number; hauteur: number; toit: boolean; accent: string }) {
  return (
    <g>
      <rect x={x} y={y} width={largeur} height={hauteur} />
      {toit ? (
        <path d={`M${x - 2} ${y} L${x + largeur / 2} ${y - 16} L${x + largeur + 2} ${y} Z`} fill={accent} />
      ) : (
        <Creneaux x={x} y={y} largeur={largeur} />
      )}
      <rect x={x + largeur / 2 - 1.5} y={y + 8} width={3} height={6} rx={1.5} className="fill-[var(--disgrace)]" />
    </g>
  )
}

export function ChateauDessin({ id, className }: { id: string; className?: string }) {
  const v = VARIANTES[id] ?? VARIANTES["chateau-or"]!
  const sommet = v.donjon ? 22 : 38
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <g className="fill-secondary stroke-[var(--disgrace)]" strokeWidth={1.5} strokeLinejoin="round">
        {v.donjon && <Tour x={38} y={24} largeur={24} hauteur={40} toit={v.toits} accent={v.accent} />}
        <rect x={22} y={52} width={56} height={38} />
        <Creneaux x={22} y={52} largeur={56} />
        <Tour x={10} y={40} largeur={18} hauteur={50} toit={v.toits} accent={v.accent} />
        <Tour x={72} y={40} largeur={18} hauteur={50} toit={v.toits} accent={v.accent} />
        <path d="M42 90 V76 a8 8 0 0 1 16 0 V90 Z" className="fill-[var(--disgrace)]" />
      </g>
      <line x1={50} y1={sommet - (v.toits && v.donjon ? 16 : 4)} x2={50} y2={sommet - 22} className="stroke-[var(--disgrace)]" strokeWidth={1.5} />
      <path d={`M50 ${sommet - 22} l12 4 l-12 4 Z`} fill={v.accent} />
    </svg>
  )
}

export function ChateauImage({ chateau, className }: { chateau: ChateauOption | undefined; className?: string }) {
  if (chateau?.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={chateau.imageUrl} alt={chateau.nom} className={cn("object-contain", className)} />
  }
  return <ChateauDessin id={chateau?.id ?? CHATEAUX_PAR_DEFAUT[0]!.id} className={className} />
}

export function ChateauPicker({ chateaux, value, onChange }: { chateaux: ChateauOption[]; value: string; onChange: (id: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Choisis ton château" className="grid grid-cols-5 gap-2">
      {chateaux.map((c) => {
        const actif = c.id === value
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={actif}
            title={c.nom}
            onClick={() => onChange(c.id)}
            className={cn(
              "aspect-square rounded-lg border-2 p-1.5 transition",
              actif ? "border-primary bg-primary/15 scale-105" : "border-transparent bg-accent/50 opacity-70 hover:opacity-100",
            )}
          >
            <ChateauImage chateau={c} className="size-full" />
          </button>
        )
      })}
    </div>
  )
}
