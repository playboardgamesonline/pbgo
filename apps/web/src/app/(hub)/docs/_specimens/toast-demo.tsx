"use client"

import { Button } from "@pbgo/ui/platform/button"
import { Toaster, toast } from "@pbgo/ui/platform/sonner"

/** Raises the two kinds of toast the site uses. The specimen mounts its own `Toaster`: on a real page it sits once, in the layout. */
export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" onClick={() => toast.success("Invitation link copied")}>
        Success
      </Button>
      <Button variant="outline" onClick={() => toast.error("The table could not be saved")}>
        Error
      </Button>
      <Toaster />
    </div>
  )
}
