"use client"

import { LockKeyIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@pbgo/ui/admin/alert"
import { Button } from "@pbgo/ui/admin/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pbgo/ui/admin/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@pbgo/ui/admin/field"
import { Input } from "@pbgo/ui/admin/input"
import { Spinner } from "@pbgo/ui/admin/spinner"
import { adminRequest } from "../../lib/admin-api"

export function LoginForm({ title, configured }: { title: string; configured: boolean }) {
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
      await adminRequest("/api/admin/login", { method: "POST", body: JSON.stringify({ login, password }) })
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
      setPending(false)
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-muted">
            <HugeiconsIcon icon={LockKeyIcon} strokeWidth={2} className="size-5" />
          </div>
          <CardTitle>Admin</CardTitle>
          <CardDescription>{title}</CardDescription>
        </CardHeader>
        <CardContent>
          {!configured ? (
            <Alert>
              <AlertTitle>Admin account not configured</AlertTitle>
              <AlertDescription>Add ADMIN_LOGIN and ADMIN_PASSWORD to the environment variables, then redeploy.</AlertDescription>
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
