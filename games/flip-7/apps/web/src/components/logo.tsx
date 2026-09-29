import { cn } from "@/lib/utils"

export function Logo({ src, className }: { src?: string; className?: string }) {
  if (!src) return <span className={cn("font-display text-6xl font-black tracking-tight drop-shadow-xl sm:text-8xl", className)}>Flip 7</span>
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Flip 7" className={cn("h-auto w-full select-none drop-shadow-xl", className)} draggable={false} />
}
