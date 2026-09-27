import { cn } from "@/lib/utils"

export function Logo({ src, className }: { src: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Courtisans" className={cn("h-auto w-full select-none drop-shadow-xl", className)} draggable={false} />
}
