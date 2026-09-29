"use client"

import { RefreshIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Button } from "@pgo/ui/admin/button"
import { Spinner } from "@pgo/ui/admin/spinner"

export function RefreshButton() {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button variant="outline" size="sm" onClick={() => start(() => router.refresh())} disabled={pending}>
      {pending ? <Spinner data-icon="inline-start" /> : <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} data-icon="inline-start" />}
      Actualiser
    </Button>
  )
}
