import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// The platform's own spacing names, which `styles/platform.css` adds to the scale (`px-gutter`, `pb-section`, `pt-navbar`, `h-navbar`). tailwind-merge
// does not know them: it takes `px-gutter` for a class of no group and keeps it next to the `px-0` that was meant to replace it, and which of the two
// wins is then a matter of the order of the generated CSS. Told that they are spacing, it merges them like `px-4`.
const twMerge = extendTailwindMerge({ extend: { theme: { spacing: ["gutter", "section", "navbar"] } } })

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
