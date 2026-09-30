"use client"

import { LinkSquare02Icon, Logout03Icon, PuzzleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createContext, useContext, useEffect, useRef } from "react"
import { cn } from "@pgo/ui/utils"
import { adminRequest } from "../../lib/admin-api"
import { ADMIN_NAV, type CountKey } from "../../lib/admin-nav"

/* Modifications non enregistrées : prévient avant de quitter la page (barre latérale, onglet fermé). */
const DirtyContext = createContext<React.RefObject<boolean> | null>(null)

export function useDirtyGuard(dirty: boolean) {
  const ref = useContext(DirtyContext)
  useEffect(() => {
    if (!ref) return
    ref.current = dirty
    return () => {
      ref.current = false
    }
  }, [dirty, ref])
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])
}

type Props = {
  title: string
  logo: string | null
  favicon: string | null
  studioUrl: string | null
  counts: Partial<Record<CountKey, number | null>>
  children: React.ReactNode
}

export function AdminShell({ title, logo, favicon, studioUrl, counts, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const dirty = useRef(false)

  async function logout() {
    await adminRequest("/api/admin/logout", { method: "POST" }).catch(() => null)
    router.refresh()
  }

  function guard(e: React.MouseEvent) {
    if (dirty.current && !window.confirm("You have unsaved changes. Leave this page anyway?")) e.preventDefault()
  }

  const mark = favicon ?? logo
  return (
    <DirtyContext.Provider value={dirty}>
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 flex h-dvh w-60 shrink-0 flex-col border-r bg-muted/40">
          <Link href="/admin/identity" onClick={guard} className="flex h-14 items-center gap-2.5 border-b px-4 font-semibold">
            {mark ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mark} alt="" className="size-7 rounded-md object-contain" />
            ) : (
              <span className="flex size-7 items-center justify-center rounded-md bg-primary text-xs text-primary-foreground">{title.slice(0, 1)}</span>
            )}
            <span className="truncate">{title}</span>
          </Link>
          <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
            {ADMIN_NAV.map((g) => (
              <div key={g.group} className="flex flex-col gap-0.5">
                <p className="px-2 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{g.group}</p>
                {g.items.map((item) => {
                  const href = `/admin/${item.path}`
                  const active = pathname === href
                  const count = item.count ? counts[item.count] : null
                  return (
                    <Link
                      key={item.path}
                      href={href}
                      onClick={guard}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-8 items-center gap-2.5 rounded-md px-2 text-sm text-foreground/80 transition-colors hover:bg-muted hover:text-foreground",
                        active && "bg-background font-medium text-foreground shadow-xs ring-1 ring-border",
                      )}
                    >
                      <HugeiconsIcon icon={item.icon} strokeWidth={2} className="size-4 shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {!!count && <span className="min-w-5 rounded-full bg-muted px-1.5 text-center text-[11px] font-medium tabular-nums text-muted-foreground">{count}</span>}
                    </Link>
                  )
                })}
              </div>
            ))}
          </nav>
          <div className="flex flex-col gap-0.5 border-t px-3 py-3">
            <a href="/" target="_blank" rel="noreferrer" className="flex h-8 items-center gap-2.5 rounded-md px-2 text-sm text-foreground/80 hover:bg-muted">
              <HugeiconsIcon icon={LinkSquare02Icon} strokeWidth={2} className="size-4" />
              View site
            </a>
            {studioUrl && (
              <a href={studioUrl} target="_blank" rel="noreferrer" className="flex h-8 items-center gap-2.5 rounded-md px-2 text-sm text-foreground/80 hover:bg-muted">
                <HugeiconsIcon icon={PuzzleIcon} strokeWidth={2} className="size-4" />
                Open Studio
              </a>
            )}
            <button type="button" onClick={logout} className="flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2 text-left text-sm text-foreground/80 hover:bg-muted">
              <HugeiconsIcon icon={Logout03Icon} strokeWidth={2} className="size-4" />
              Log out
            </button>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-8 py-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </DirtyContext.Provider>
  )
}

export function PageHeader({ title, description, actions }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
