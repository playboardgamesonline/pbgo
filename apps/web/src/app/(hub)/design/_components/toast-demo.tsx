"use client"

import { Button } from "@pbgo/ui/platform/button"
import { Toaster, toast } from "@pbgo/ui/platform/sonner"

const wait = () => new Promise((resolve) => setTimeout(resolve, 1500))

/** Raises each kind of toast. The page mounts its own `Toaster`: on a real page it sits once, in the layout. */
export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" onClick={() => toast("Table created")}>
        Default
      </Button>
      <Button variant="outline" onClick={() => toast.success("Invitation link copied")}>
        Success
      </Button>
      <Button variant="outline" onClick={() => toast.info("Waiting for two more players")}>
        Info
      </Button>
      <Button variant="outline" onClick={() => toast.warning("Your connection is unstable")}>
        Warning
      </Button>
      <Button variant="outline" onClick={() => toast.error("The table could not be saved")}>
        Error
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.promise(wait(), { loading: "Saving…", success: "Saved", error: "Not saved" })}
      >
        Promise
      </Button>
      <Toaster />
    </div>
  )
}
