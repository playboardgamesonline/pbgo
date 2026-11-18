import { spawnSync } from "node:child_process"
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it } from "vitest"

// `scripts/go-live.sh` and `scripts/setup-env.sh` make things outside the repo (a Sanity project, a token, a Studio): they are never run for real to be tested. These run them in a fake root (a copy of
// the scripts, a registry of two games, the files of one Studio) with a stand-in for curl that answers from a table and logs what it was asked (`test-fixtures/fake-curl.sh`), so that nothing leaves the machine.
// A route is "<METHOD or *> <text> <status> <body>", the text being one word found in the URL or in the token the script gives curl on its stdin.
const REPO = fileURLToPath(new URL("../../../", import.meta.url))
const FIXTURES = join(REPO, "packages/games/src/test-fixtures")

const REGISTRY = (id: string) => `export const GAMES = [
  {
    slug: "other",
    name: "Other",
    sanityProjectId: "otherid1",
    live: false,
  },
  {
    slug: "demo",
    name: "Demo",
    sanityProjectId: "${id}",
    live: false,
  },
] as const
`
const STUDIO_CLI = (id: string) => `export default defineCliConfig({ api: { projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "${id}" }, studioHost: "demo" })\n`
const STUDIO_CONFIG = (id: string) => `export default defineConfig({ projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "${id}" })\n`

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

type World = { root: string; log: () => string; file: (path: string) => string; has: (path: string) => boolean; run: (script: string, args?: string[], extra?: Record<string, string>) => { status: number | null; out: string } }

/** A fake root: the scripts, a registry whose `demo` has `id`, its Studio and seed config, a Sanity login, the stand-ins for curl, pnpm and npx, and `routes` for the curl. */
function world({ id, token = null, routes = [] }: { id: string; token?: string | null; routes?: string[] }): World {
  const root = mkdtempSync(join(tmpdir(), "go-live-"))
  roots.push(root)
  const put = (path: string, text: string) => {
    mkdirSync(join(root, path, ".."), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  mkdirSync(join(root, "scripts"))
  for (const script of ["go-live.sh", "lib.sh", "setup-env.sh"]) copyFileSync(join(REPO, "scripts", script), join(root, "scripts", script))
  mkdirSync(join(root, "bin"))
  copyFileSync(join(FIXTURES, "fake-curl.sh"), join(root, "bin/curl"))
  for (const tool of ["pnpm", "npx"]) put(`bin/${tool}`, "#!/usr/bin/env bash\nexit 0\n")
  for (const tool of ["curl", "pnpm", "npx"]) chmodSync(join(root, "bin", tool), 0o755)
  put("package.json", '{ "type": "module" }\n')
  put("home/.config/sanity/config.json", '{ "authToken": "login-token" }\n')
  put("packages/games/src/registry.ts", REGISTRY(id))
  put("games/demo/apps/studio/sanity.cli.ts", STUDIO_CLI(id))
  put("games/demo/apps/studio/sanity.config.ts", STUDIO_CONFIG(id))
  put("games/demo/content/config.ts", `export const SLUG = "demo"\nexport const PROJECT_ID = "${id}"\n`)
  put("games/demo/CLAUDE.md", `- \`apps/studio\` — Sanity Studio of the project \`${id}\`\n`)
  mkdirSync(join(root, "apps/web"), { recursive: true })
  if (token !== null) put("apps/web/.env.local", `SANITY_API_WRITE_TOKEN_DEMO=${token}\n`)
  put("routes.txt", `${routes.join("\n")}\n`)
  put("calls.log", "")
  return {
    root,
    log: () => readFileSync(join(root, "calls.log"), "utf8"),
    file: (path) => readFileSync(join(root, path), "utf8"),
    has: (path) => existsSync(join(root, path)),
    run: (script, args = [], extra = {}) => {
      const run = spawnSync("bash", [join(root, "scripts", script), ...args], {
        cwd: root,
        encoding: "utf8",
        timeout: 60_000,
        env: { ...process.env, PATH: `${join(root, "bin")}:${process.env.PATH ?? ""}`, HOME: join(root, "home"), TMPDIR: root, FAKE_CURL_ROUTES: join(root, "routes.txt"), FAKE_CURL_LOG: join(root, "calls.log"), ...extra },
      })
      return { status: run.status, out: `${run.stdout}${run.stderr}` }
    },
  }
}

const GONE = 'GET /v2021-06-07/projects/deadid01 404 {"statusCode":404,"message":"Project not found"}'
const ALIVE = 'GET /v2021-06-07/projects/liveid01 200 {"id":"liveid01"}'
/** What making a project anew asks of Sanity, in the order the fake curl must answer (the first route that fits answers). */
const MAKING = ['POST /v2021-06-07/projects/newid001/tokens 200 {"key":"sk-newtoken"}', 'POST /v2021-06-07/projects 200 {"id":"newid001"}', 'GET /v2021-06-07/organizations 200 [{"id":"org1","name":"Main"}]', "GET /v2021-06-07/projects 200 []"]
const writes = (log: string) => log.split("\n").filter((line) => /^(POST|PUT|DELETE|PATCH) /.test(line))

describe("pnpm go-live, a project id that Sanity does not know", () => {
  it("stops with the way out and makes nothing: no project, no dataset, no token, no file changed", () => {
    const w = world({ id: "deadid01", routes: [GONE] })
    const run = w.run("go-live.sh", ["demo"])
    expect(run.status).toBe(1)
    expect(run.out).toContain("Sanity project deadid01 (the registry) is not one of this login's projects")
    expect(run.out).toContain("pnpm go-live demo --new-project")
    expect(run.out).not.toContain("Dataset production")
    expect(writes(w.log())).toEqual([])
    expect(w.file("packages/games/src/registry.ts")).toBe(REGISTRY("deadid01"))
    expect(w.has("games/demo/.sanity-project-id")).toBe(false)
  })

  it("says what is wrong when the login is no longer good, or Sanity does not answer, and makes nothing then either", () => {
    for (const [route, words] of [
      ["GET /v2021-06-07/projects/deadid01 401 {}", "the Sanity login is no longer good"],
      ["GET /v2021-06-07/projects/deadid01 000 {}", "Sanity did not answer about the project deadid01"],
    ] as const) {
      const w = world({ id: "deadid01", routes: [route] })
      const run = w.run("go-live.sh", ["demo"])
      expect(run.status, words).toBe(1)
      expect(run.out, words).toContain(words)
      expect(writes(w.log()), words).toEqual([])
    }
  })

  it("is not fooled by the id left in .sanity-project-id after the registry went back to the placeholder", () => {
    const w = world({ id: "__SANITY_PROJECT_ID__", routes: [GONE] })
    writeFileSync(join(w.root, "games/demo/.sanity-project-id"), "deadid01\n")
    const run = w.run("go-live.sh", ["demo"])
    expect(run.status).toBe(1)
    expect(run.out).toContain("Sanity project deadid01 (games/demo/.sanity-project-id) is not one of this login's projects")
  })

  it("makes the project anew with --new-project and writes the new id over the old one in the registry, the Studio and the seed's config, and only for that game", () => {
    const w = world({ id: "deadid01", token: "old-token", routes: [GONE, ...MAKING, "* old-token 401 {}"] })
    const run = w.run("go-live.sh", ["demo", "--new-project"])
    expect(run.status).toBe(0)
    expect(run.out).toContain("Sanity project deadid01 (the registry) is not one of this login's projects: a new one is made for demo")
    expect(run.out).toContain("Sanity project created: demo (newid001)")
    const registry = w.file("packages/games/src/registry.ts")
    expect(registry).toBe(REGISTRY("newid001"))
    expect(registry).toContain('sanityProjectId: "otherid1"')
    for (const path of ["games/demo/apps/studio/sanity.cli.ts", "games/demo/apps/studio/sanity.config.ts", "games/demo/content/config.ts"]) {
      expect(w.file(path), path).toContain("newid001")
      expect(w.file(path), path).not.toContain("deadid01")
    }
    expect(w.file("games/demo/.sanity-project-id").trim()).toBe("newid001")
    // the notes keep the old id until someone rewrites the sentence: the script says where
    expect(run.out).toContain("the old id deadid01 is still written in: games/demo/CLAUDE.md")
  })

  it("replaces a write token that the project does not take, says so, and never prints a token or puts one in an argument", () => {
    const w = world({ id: "deadid01", token: "old-token", routes: [GONE, ...MAKING, "* old-token 401 {}"] })
    const run = w.run("go-live.sh", ["demo", "--new-project"])
    expect(run.out).toContain("SANITY_API_WRITE_TOKEN_DEMO in apps/web/.env.local is not taken by the project newid001")
    expect(run.out).toContain("SANITY_API_WRITE_TOKEN_DEMO created (editor)")
    expect(w.file("apps/web/.env.local")).toBe("SANITY_API_WRITE_TOKEN_DEMO=sk-newtoken\n")
    expect(run.out).not.toMatch(/old-token|sk-newtoken|login-token/)
    const argLines = w.log().split("\n").filter((line) => line.includes("args:"))
    expect(argLines.join("\n")).not.toMatch(/old-token|sk-newtoken/)
    expect(w.log()).toContain("stdin: header = \"Authorization: Bearer old-token\"")
  })

  it("refuses --new-project for an id whose project is there: there is nothing to replace", () => {
    const w = world({ id: "liveid01", routes: [ALIVE, ...MAKING] })
    const run = w.run("go-live.sh", ["demo", "--new-project"])
    expect(run.status).toBe(1)
    expect(run.out).toContain("Sanity project liveid01 exists under this login: --new-project is for an id whose project is gone, nothing was changed")
    expect(writes(w.log())).toEqual([])
    expect(w.file("packages/games/src/registry.ts")).toBe(REGISTRY("liveid01"))
  })
})

describe("pnpm go-live, the write token of a project that is there", () => {
  it("keeps a token that the project takes, and makes none", () => {
    const w = world({ id: "liveid01", token: "good-token", routes: [ALIVE] })
    const run = w.run("go-live.sh", ["demo"])
    expect(run.status).toBe(0)
    expect(run.out).toContain("SANITY_API_WRITE_TOKEN_DEMO already in apps/web/.env.local, and the project takes it")
    expect(w.file("apps/web/.env.local")).toBe("SANITY_API_WRITE_TOKEN_DEMO=good-token\n")
    expect(writes(w.log()).some((line) => line.includes("/tokens"))).toBe(false)
  })

  it("keeps a token it could not try (no answer from the project), and says so", () => {
    const w = world({ id: "liveid01", token: "some-token", routes: [ALIVE, "* some-token 000 {}"] })
    const run = w.run("go-live.sh", ["demo"])
    expect(run.out).toContain("could not be tried against the project liveid01 (no answer): kept as it is")
    expect(w.file("apps/web/.env.local")).toBe("SANITY_API_WRITE_TOKEN_DEMO=some-token\n")
  })

  it("makes a token when there is none", () => {
    const w = world({ id: "liveid01", routes: [ALIVE, 'POST /v2021-06-07/projects/liveid01/tokens 200 {"key":"sk-first"}'] })
    const run = w.run("go-live.sh", ["demo"])
    expect(run.out).toContain("SANITY_API_WRITE_TOKEN_DEMO created (editor)")
    expect(w.file("apps/web/.env.local")).toBe("SANITY_API_WRITE_TOKEN_DEMO=sk-first\n")
  })
})

describe("the helpers of scripts/lib.sh", () => {
  const helper = (w: World, call: string) => spawnSync("bash", ["-c", `ROOT="${w.root}"; source "${w.root}/scripts/lib.sh"; STOKEN=login-token; ${call}`], { encoding: "utf8", env: { ...process.env, PATH: `${join(w.root, "bin")}:${process.env.PATH ?? ""}`, FAKE_CURL_ROUTES: join(w.root, "routes.txt"), FAKE_CURL_LOG: join(w.root, "calls.log") } }).stdout

  it("tell the status of a project and of a token, and the token goes in on stdin, never as an argument", () => {
    const w = world({ id: "liveid01", routes: [GONE, ALIVE, "* stale-token 401 {}"] })
    expect(helper(w, "sanity_project_status deadid01")).toBe("404")
    expect(helper(w, "sanity_project_status liveid01")).toBe("200")
    expect(helper(w, "sanity_token_status liveid01 stale-token")).toBe("401")
    expect(helper(w, "sanity_token_status liveid01 fresh-token")).toBe("200")
    const log = w.log()
    expect(log.split("\n").filter((line) => line.includes("args:")).join("\n")).not.toMatch(/stale-token|fresh-token/)
    expect(log).toContain('stdin: header = "Authorization: Bearer stale-token"')
  })
})

describe("pnpm setup-env, which write token it reuses", () => {
  // The function is read out of the script and run alone: the script as a whole needs Supabase, Vercel and a secrets file.
  const source = readFileSync(join(REPO, "scripts/setup-env.sh"), "utf8")
  const fn = /^first_working_token\(\) \{[\s\S]*?^\}$/m.exec(source)?.[0] ?? ""

  /** Runs `first_working_token KEY pid` with the three places holding what `held` says (a missing key: nothing there), and prints what it settled. */
  function pick(held: { secrets?: string; env?: string; vercel?: string }, routes: string[]) {
    const w = world({ id: "liveid01", routes })
    const script = `ROOT="${w.root}"; source "${w.root}/scripts/lib.sh"; STOKEN=login-token
SECRETS=/s/secrets.env; ENV_FILE=/s/.env.local; FROM_VERCEL="|"
secret() { printf '%s' "$T_SECRETS"; }
envget() { printf '%s' "$T_ENV"; }
vercel_secret() { echo read >> "$T_MARK"; printf '%s' "$T_VERCEL"; }
${fn}
if first_working_token SANITY_API_WRITE_TOKEN_DEMO liveid01; then echo "token=$TOKEN_VAL stale=$STALE from=$TOKEN_FROM vercel=$FROM_VERCEL"; else echo "none stale=$STALE"; fi`
    const run = spawnSync("bash", ["-c", script], {
      encoding: "utf8",
      env: { ...process.env, PATH: `${join(w.root, "bin")}:${process.env.PATH ?? ""}`, FAKE_CURL_ROUTES: join(w.root, "routes.txt"), FAKE_CURL_LOG: join(w.root, "calls.log"), T_SECRETS: held.secrets ?? "", T_ENV: held.env ?? "", T_VERCEL: held.vercel ?? "", T_MARK: join(w.root, "vercel-reads.txt") },
    })
    return { out: run.stdout.trim(), vercelReads: w.has("vercel-reads.txt") }
  }
  const STALE = ["* stale 401 {}"]

  it("is there to be run", () => {
    expect(fn).toContain("sanity_token_status")
  })

  it("skips a token that the project refuses and takes the next one that it takes, naming where the refused one is", () => {
    expect(pick({ secrets: "stale-secrets-token", env: "good-env-token" }, STALE).out).toBe("token=good-env-token stale=/s/secrets.env from= vercel=|")
  })

  it("reads the Vercel project last, and not at all when an earlier place has a token that works", () => {
    const first = pick({ secrets: "good-token", vercel: "good-vercel-token-0123456789" }, STALE)
    expect(first.out).toBe("token=good-token stale= from= vercel=|")
    expect(first.vercelReads).toBe(false)
    const last = pick({ secrets: "stale-a", env: "stale-b", vercel: "good-vercel-token-0123456789" }, STALE)
    expect(last.out).toBe("token=good-vercel-token-0123456789 stale=/s/secrets.env, /s/.env.local from= (reused from the Vercel project) vercel=|SANITY_API_WRITE_TOKEN_DEMO|")
  })

  it("finds none when every place holds a token that the project refuses, and says where they are", () => {
    expect(pick({ secrets: "stale-a", env: "stale-b", vercel: "stale-vercel-token-0123456789" }, STALE).out).toBe("none stale=/s/secrets.env, /s/.env.local, the Vercel project")
  })

  it("keeps a token that could not be tried, as it did before: a project that does not answer is no reason to make another", () => {
    expect(pick({ env: "silent-token" }, ["* silent 000 {}"]).out).toBe("token=silent-token stale= from= vercel=|")
  })

  it("ignores what the Vercel list gives for a secret (its ciphertext) and a value that is not the shape of a token", () => {
    expect(pick({ vercel: "eyJhbGciOiJBMjU2S1cifQ0123456789" }, []).out).toBe("none stale=")
    expect(pick({ vercel: "short" }, []).out).toBe("none stale=")
  })
})
