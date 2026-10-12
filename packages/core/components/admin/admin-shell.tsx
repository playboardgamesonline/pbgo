"use client"

import { DashboardSquare01Icon, LinkSquare02Icon, Logout03Icon, PuzzleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createContext, useContext, useEffect, useRef } from "react"
import { cn } from "@pbgo/ui/utils"
import { adminRequest } from "../../lib/admin-api"
import { ADMIN_NAV, adminHref, type CountKey, GAMEMASTER_PATH, LOGIN_PATH } from "../../lib/admin-nav"
import { GameSwitcher, type SwitcherGame } from "./game-switcher"

/* Unsaved changes: warns before leaving the page (sidebar link, game switcher, closed tab). */
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
  /** Every game of the registry, for the switcher */
  games: SwitcherGame[]
  /** The game whose pages the sidebar lists; null on the overview, which has none */
  game: { slug: string; studioUrl: string | null; counts: Partial<Record<CountKey, number | null>> } | null
  children: React.ReactNode
}

const LINK = "flex h-8 items-center gap-2.5 rounded-md px-2 text-sm text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
const ACTIVE = "bg-background text-foreground shadow-surface ring-1 ring-border"

export function AdminShell({ games, game, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const dirty = useRef(false)

  async function logout() {
    await adminRequest(`${GAMEMASTER_PATH}/api/logout`, { method: "POST" }).catch(() => null)
    router.replace(LOGIN_PATH)
  }

  function confirmLeave() {
    return !dirty.current || window.confirm("You have unsaved changes. Leave this page anyway?")
  }

  function guard(e: React.MouseEvent) {
    if (!confirmLeave()) e.preventDefault()
  }

  const overview = pathname === GAMEMASTER_PATH
  return (
    <DirtyContext.Provider value={dirty}>
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 flex h-dvh w-64 shrink-0 flex-col border-r bg-muted/40">
          <div className="border-b p-3">
            <GameSwitcher games={games} slug={game?.slug ?? null} confirmLeave={confirmLeave} />
          </div>
          <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
            <Link href={GAMEMASTER_PATH} onClick={guard} aria-current={overview ? "page" : undefined} className={cn(LINK, overview && ACTIVE)}>
              <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} className="size-4 shrink-0" />
              Overview
            </Link>
            {game &&
              ADMIN_NAV.map((g) => (
                <div key={g.group} className="flex flex-col gap-0.5">
                  <p className="px-2 pb-1 text-xs tracking-wider text-muted-foreground uppercase">{g.group}</p>
                  {g.items.map((item) => {
                    const href = adminHref(game.slug, item.path)
                    const active = pathname === href
                    const count = item.count ? game.counts[item.count] : null
                    return (
                      <Link key={item.path} href={href} onClick={guard} aria-current={active ? "page" : undefined} className={cn(LINK, active && ACTIVE)}>
                        <HugeiconsIcon icon={item.icon} strokeWidth={2} className="size-4 shrink-0" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {!!count && <span className="min-w-5 rounded-full bg-muted px-1.5 text-center text-xs tabular-nums text-muted-foreground">{count}</span>}
                      </Link>
                    )
                  })}
                </div>
              ))}
          </nav>
          <div className="flex flex-col gap-0.5 border-t px-3 py-3">
            {game && (
              <a href={`/${game.slug}`} target="_blank" rel="noreferrer" className={LINK}>
                <HugeiconsIcon icon={LinkSquare02Icon} strokeWidth={2} className="size-4" />
                View game
              </a>
            )}
            {game?.studioUrl && (
              <a href={game.studioUrl} target="_blank" rel="noreferrer" className={LINK}>
                <HugeiconsIcon icon={PuzzleIcon} strokeWidth={2} className="size-4" />
                Open Studio
              </a>
            )}
            <button type="button" onClick={logout} className={cn(LINK, "cursor-pointer text-left")}>
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
        <h1 className="flex items-center gap-3 text-2xl">{title}</h1>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
