import { redirect } from "next/navigation"
import { LoginForm } from "../../components/admin/login-form"
import { safeNext } from "../../lib/admin-nav"
import { adminProblems, isAdmin } from "../../server/admin"

/** `/gamemaster/login`. `next`: the page that sent the visitor here; someone who already has a session goes straight to it. */
export async function LoginPage({ next }: { next: string | string[] | undefined }) {
  const target = safeNext(Array.isArray(next) ? next[0] : next)
  if (await isAdmin()) redirect(target)
  return <LoginForm problems={adminProblems()} next={target} />
}
