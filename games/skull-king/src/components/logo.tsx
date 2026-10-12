import { cn } from "@pbgo/ui/utils"
import { NAME } from "../lib/site"

export function Logo({ src, alt = NAME, className }: { src: string; alt?: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={cn("h-auto w-full select-none drop-shadow-xl", className)} draggable={false} />
}
