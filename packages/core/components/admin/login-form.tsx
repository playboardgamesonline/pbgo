"use client"

import { LockKeyIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@pbgo/ui/platform/alert"
import { Button } from "@pbgo/ui/platform/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pbgo/ui/platform/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@pbgo/ui/platform/field"
import { Input } from "@pbgo/ui/platform/input"
import { Spinner } from "@pbgo/ui/platform/spinner"
import { adminRequest } from "../../lib/admin-api"
import { GAMEMASTER_PATH } from "../../lib/admin-nav"

/**
 * Sign-in of the gamemaster. `problems`: what keeps the gamemaster closed (a credential or the session secret is missing), empty when
 * it can be used. `next`: the page to open once signed in, already checked by `safeNext`.
 */
export function LoginForm({ problems, next }: { problems: string[]; next: string }) {
  const router = useRouter()
  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      await adminRequest(`${GAMEMASTER_PATH}/api/login`, { method: "POST", body: JSON.stringify({ login, password }) })
      router.replace(next)
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-muted">
            <HugeiconsIcon icon={LockKeyIcon} strokeWidth={2} className="size-5" />
          </div>
          <CardTitle>Gamemaster</CardTitle>
          <CardDescription>One back office for every game.</CardDescription>
        </CardHeader>
        <CardContent>
          {problems.length > 0 ? (
            <Alert>
              <AlertTitle>Gamemaster not configured</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {problems.map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
                <p className="mt-2">Set them in the environment variables, then redeploy.</p>
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={submit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="login">Login</FieldLabel>
                  <Input id="login" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} autoFocus required />
                </Field>
                <Field data-invalid={!!error}>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!error} required />
                  {error && <FieldError>{error}</FieldError>}
                </Field>
                <Button type="submit" disabled={pending} className="w-full">
                  {pending && <Spinner />}
                  Log in
                </Button>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
