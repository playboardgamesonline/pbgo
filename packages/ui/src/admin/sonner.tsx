"use client"

import { Alert02Icon, CheckmarkCircle02Icon, InformationCircleIcon, Loading03Icon, CancelCircleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

/** Toasts de l'admin : style shadcn (luma), icônes Hugeicons. `admin-portal` porte les variables du thème de l'admin. */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group admin-portal"
      icons={{
        success: <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4" />,
        info: <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} className="size-4" />,
        warning: <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-4" />,
        error: <HugeiconsIcon icon={CancelCircleIcon} strokeWidth={2} className="size-4" />,
        loading: <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
