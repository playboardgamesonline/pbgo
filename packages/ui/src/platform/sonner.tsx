"use client"

import { Alert02Icon, CheckmarkCircle02Icon, InformationCircleIcon, Loading03Icon, CancelCircleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast, Toaster as Sonner, type ToasterProps } from "sonner"

/** Platform toasts: shadcn (luma) style, Hugeicons icons. The `platform` class carries the platform theme variables, since the toaster is rendered outside the `.platform` wrapper of the page. */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group platform"
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

/** `toast` is re-exported so a platform page raises toasts without depending on `sonner` itself. */
export { Toaster, toast }
