import { cn } from "@/lib/utils"

export function Logo({ src, alt, className }: { src: string; alt: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={cn("h-auto w-full select-none drop-shadow-xl", className)} draggable={false} />
}
