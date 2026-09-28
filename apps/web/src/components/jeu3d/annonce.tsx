"use client"

import { useControls } from "leva"
import { motion } from "motion/react"
import { useEffect, useRef } from "react"
import { jouerSon, type NomSon } from "@/lib/son"
import { cn } from "@/lib/utils"
import { boutonCopie, onglet } from "./onglets-debug"

export type TypeAnnonce = "banquet" | "tour" | "victoire"

const DEFAUT = {
  duree: 2.4,
  son: true,
  voile: 0.3,
  fondu: 0.3,
  taille: 4.5,
  tailleSous: 2,
  espacement: 0.06,
  couleurTexte: "#ffffff",
  contour: 3,
  couleurContour: "#f2b705",
  ombre: 4,
  flou: 18,
  echelleDepart: 0.85,
  rebond: 16,
  lignes: true,
  dureeLignes: 2.6,
  epaisseurLignes: 3,
  couleurLignes: "#f5c542",
  ecartLignes: 24,
  haut: false,
  degrade: false,
  hauteurDegrade: 45,
  confettis: false,
  nombreConfettis: 110,
  couleurConfettis: "#ffd35c",
  tailleConfettis: 1,
  vitesseConfettis: 1,
  lueurConfettis: 16,
}
export type ReglagesAnnonce = typeof DEFAUT

function schema(defaut: ReglagesAnnonce, dossier: string) {
  return {
    duree: { value: defaut.duree, min: 0.5, max: 8, step: 0.1, label: "duration (s)" },
    son: { value: defaut.son, label: "sound" },
    voile: { value: defaut.voile, min: 0, max: 1, step: 0.01, label: "overlay opacity" },
    fondu: { value: defaut.fondu, min: 0, max: 2, step: 0.05, label: "fade (s)" },
    taille: { value: defaut.taille, min: 1, max: 10, step: 0.1, label: "text size (rem)" },
    tailleSous: { value: defaut.tailleSous, min: 0.5, max: 6, step: 0.1, label: "subtitle size (rem)" },
    espacement: { value: defaut.espacement, min: 0, max: 0.5, step: 0.01, label: "letter spacing (em)" },
    couleurTexte: { value: defaut.couleurTexte, label: "text color" },
    contour: { value: defaut.contour, min: 0, max: 10, step: 0.5, label: "outline (px)" },
    couleurContour: { value: defaut.couleurContour, label: "outline color" },
    ombre: { value: defaut.ombre, min: 0, max: 20, step: 0.5, label: "shadow (px)" },
    flou: { value: defaut.flou, min: 0, max: 60, step: 1, label: "shadow blur (px)" },
    echelleDepart: { value: defaut.echelleDepart, min: 0.2, max: 2, step: 0.01, label: "start scale" },
    rebond: { value: defaut.rebond, min: 4, max: 40, step: 1, label: "damping" },
    lignes: { value: defaut.lignes, label: "lines" },
    dureeLignes: { value: defaut.dureeLignes, min: 0.3, max: 6, step: 0.1, label: "lines duration (s)" },
    epaisseurLignes: { value: defaut.epaisseurLignes, min: 1, max: 12, step: 0.5, label: "lines thickness (px)" },
    couleurLignes: { value: defaut.couleurLignes, label: "lines color" },
    ecartLignes: { value: defaut.ecartLignes, min: 0, max: 120, step: 1, label: "lines gap (px)" },
    haut: { value: defaut.haut, label: "at top of screen" },
    degrade: { value: defaut.degrade, label: "gradient overlay" },
    hauteurDegrade: { value: defaut.hauteurDegrade, min: 5, max: 100, step: 1, label: "gradient height (%)" },
    confettis: { value: defaut.confettis, label: "confetti" },
    nombreConfettis: { value: defaut.nombreConfettis, min: 0, max: 400, step: 1, label: "confetti count" },
    couleurConfettis: { value: defaut.couleurConfettis, label: "confetti color" },
    tailleConfettis: { value: defaut.tailleConfettis, min: 0.2, max: 4, step: 0.05, label: "confetti size" },
    vitesseConfettis: { value: defaut.vitesseConfettis, min: 0.1, max: 4, step: 0.05, label: "confetti speed" },
    lueurConfettis: { value: defaut.lueurConfettis, min: 0, max: 60, step: 1, label: "confetti glow" },
    ...boutonCopie("TRANSITION", dossier),
  }
}

export function useReglagesAnnonces(): Record<TypeAnnonce, ReglagesAnnonce> {
  const banquet = useControls("Announcement · Banquet", schema(DEFAUT, "Announcement · Banquet"), { collapsed: true, order: 2 }, onglet("TRANSITION"))
  const tour = useControls(
    "Announcement · Your Turn",
    schema(
      {
        ...DEFAUT,
        haut: true,
        degrade: true,
        voile: 0.55,
        lignes: false,
        taille: 2.2,
        contour: 0,
        ombre: 2,
        flou: 12,
        echelleDepart: 0.96,
        duree: 2,
      },
      "Announcement · Your Turn",
    ),
    { collapsed: true, order: 3 },
    onglet("TRANSITION"),
  )
  const victoire = useControls(
    "Announcement · Victory",
    schema(
      {
        ...DEFAUT,
        duree: 4.5,
        son: false,
        voile: 0.18,
        taille: 2.4,
        tailleSous: 1.6,
        contour: 0,
        ombre: 2,
        flou: 14,
        lignes: false,
        confettis: true,
      },
      "Announcement · Victory",
    ),
    { collapsed: true, order: 4 },
    onglet("TRANSITION"),
  )
  return { banquet: banquet as ReglagesAnnonce, tour: tour as ReglagesAnnonce, victoire: victoire as ReglagesAnnonce }
}

function Ligne({ sens, r }: { sens: 1 | -1; r: ReglagesAnnonce }) {
  return (
    <div className="relative w-full overflow-hidden" style={{ height: r.epaisseurLignes }}>
      <motion.div
        className="absolute inset-y-0 w-[70%]"
        style={{ background: `linear-gradient(90deg, transparent, ${r.couleurLignes} 30%, #fff4d6 50%, ${r.couleurLignes} 70%, transparent)` }}
        initial={{ x: sens === 1 ? "-100%" : "145%" }}
        animate={{ x: sens === 1 ? "145%" : "-100%" }}
        transition={{ duration: r.dureeLignes, ease: [0.45, 0, 0.2, 1] }}
      />
    </div>
  )
}

type Particule = { x: number; y: number; vx: number; vy: number; taille: number; angle: number; spin: number; phase: number; freq: number }

function Confettis({ r }: { r: ReglagesAnnonce }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const resize = () => {
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
    }
    resize()
    const W = () => canvas.width
    const H = () => canvas.height
    const particules: Particule[] = Array.from({ length: r.nombreConfettis }, () => ({
      x: Math.random() * W(),
      y: -Math.random() * H() * 0.8,
      vx: (Math.random() - 0.5) * 40 * dpr,
      vy: (60 + Math.random() * 90) * dpr,
      taille: (3 + Math.random() * 6) * dpr * r.tailleConfettis,
      angle: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 3,
      phase: Math.random() * Math.PI * 2,
      freq: 2 + Math.random() * 4,
    }))
    const etoile = (x: number, y: number, t: number, a: number) => {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(a)
      ctx.beginPath()
      for (let k = 0; k < 8; k++) {
        const rayon = k % 2 === 0 ? t : t * 0.28
        const ang = (k * Math.PI) / 4
        ctx.lineTo(Math.cos(ang) * rayon, Math.sin(ang) * rayon)
      }
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
    let debut = performance.now()
    let precedent = debut
    let id = 0
    const boucle = (maintenant: number) => {
      const dt = Math.min(0.05, (maintenant - precedent) / 1000) * r.vitesseConfettis
      precedent = maintenant
      const temps = (maintenant - debut) / 1000
      ctx.clearRect(0, 0, W(), H())
      ctx.globalCompositeOperation = "lighter"
      ctx.shadowColor = r.couleurConfettis
      ctx.shadowBlur = r.lueurConfettis * dpr
      for (const p of particules) {
        p.x += (p.vx + Math.sin(temps * 1.3 + p.phase) * 25 * dpr) * dt
        p.y += p.vy * dt
        p.angle += p.spin * dt
        if (p.y > H() + 20) {
          p.y = -20
          p.x = Math.random() * W()
        }
        const scintille = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(temps * p.freq + p.phase), 3)
        ctx.globalAlpha = scintille
        ctx.fillStyle = r.couleurConfettis
        etoile(p.x, p.y, p.taille * (0.7 + 0.3 * scintille), p.angle)
        ctx.fillStyle = "#fffbe8"
        etoile(p.x, p.y, p.taille * 0.35, p.angle)
      }
      ctx.globalAlpha = 1
      id = requestAnimationFrame(boucle)
    }
    id = requestAnimationFrame(boucle)
    window.addEventListener("resize", resize)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener("resize", resize)
      debut = 0
    }
  }, [r.nombreConfettis, r.couleurConfettis, r.tailleConfettis, r.vitesseConfettis, r.lueurConfettis])
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 size-full" />
}

export function Annonce({ texte, sousTexte, son, reglages: r }: { texte: string; sousTexte?: string; son: NomSon; reglages: ReglagesAnnonce }) {
  useEffect(() => {
    if (r.son) jouerSon(son)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [son])
  const style = {
    color: r.couleurTexte,
    WebkitTextStroke: r.contour ? `${r.contour}px ${r.couleurContour}` : undefined,
    paintOrder: "stroke fill",
    filter: `drop-shadow(0 ${r.ombre}px 0 rgb(0 0 0 / 85%)) drop-shadow(0 ${r.ombre * 2.5}px ${r.flou}px rgb(0 0 0 / 60%))`,
  } as const
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: r.fondu + 0.2 } }}
      transition={{ duration: r.fondu }}
      className={cn("pointer-events-none absolute inset-0 z-40 flex justify-center", r.haut ? "items-start pt-[9vh]" : "items-center")}
      style={
        r.degrade
          ? { background: `linear-gradient(to bottom, rgb(0 0 0 / ${r.voile}) 0%, transparent ${r.hauteurDegrade}%)` }
          : { backgroundColor: `rgb(0 0 0 / ${r.voile})` }
      }
    >
      {r.confettis && <Confettis r={r} />}
      <div className="relative flex w-full flex-col items-center" style={{ gap: r.ecartLignes }}>
        {r.lignes && <Ligne sens={1} r={r} />}
        <motion.div
          initial={{ opacity: 0, scale: r.echelleDepart, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: r.rebond, delay: 0.1 }}
          className="flex flex-col items-center gap-2 px-6 text-center font-typey uppercase"
        >
          <h2 style={{ ...style, fontSize: `${r.taille}rem`, lineHeight: 1.1, letterSpacing: `${r.espacement}em` }}>{texte}</h2>
          {sousTexte && <p style={{ ...style, fontSize: `${r.tailleSous}rem`, lineHeight: 1.1, letterSpacing: `${r.espacement}em` }}>{sousTexte}</p>}
        </motion.div>
        {r.lignes && <Ligne sens={-1} r={r} />}
      </div>
    </motion.div>
  )
}
