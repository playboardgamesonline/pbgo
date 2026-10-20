import { createHash } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { apiVersion } from "@pbgo/core/sanity/env.ts"
import { afterEach, describe, expect, it } from "vitest"
import { UsageError } from "./cli.ts"
import { MemoryStore } from "./memory-store.ts"
import { RULEBOOK_HELP, parseRulebookCli, runRulebookCli } from "./rulebook-cli.ts"
import type { RulebookCliDeps } from "./rulebook-cli.ts"
import { RulebookError, expectedFileAssetId, fileRef } from "./rulebook.ts"
import { TempFolders } from "./test-fixtures.ts"
import type { StoredDoc } from "./types.ts"

const temp = new TempFolders()
afterEach(() => temp.cleanUp())

/** Not a real token: it only has to be recognisable in what is printed. */
const TOKEN = "skTESTTOKEN0123456789abcdefghijklmnop"

/** A file that starts like a PDF. Two texts give two different files, so two different content hashes. */
const pdf = (text = "rules") => Buffer.from(`%PDF-1.4\n% ${text}\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`)
const sha1Of = (data: Buffer) => createHash("sha1").update(data).digest("hex")
const refOf = (text: string) => fileRef(expectedFileAssetId(sha1Of(pdf(text))))

const PLACE = ["place", "--slug", "hanabi", "--project", "ho5ap9a6"]

/** Runs the command against an in-memory dataset and keeps what it printed, which token it asked for and how it connected. */
function harness(deps: Partial<RulebookCliDeps> = {}) {
  const store = new MemoryStore()
  const out: string[] = []
  const err: string[] = []
  const tokens: Array<{ slug: string; envFile: string }> = []
  const connections: Array<Parameters<RulebookCliDeps["connect"]>[0]> = []
  const all: Partial<RulebookCliDeps> = {
    readToken: ({ slug, envFile }) => {
      tokens.push({ slug, envFile })
      return TOKEN
    },
    connect: (config) => {
      connections.push(config)
      return store
    },
    log: (text) => out.push(text),
    error: (text) => err.push(text),
    ...deps,
  }
  return { store, out, err, tokens, connections, run: (argv: string[]) => runRulebookCli(argv, all) }
}

const settingsDraft = (store: MemoryStore) => store.docs.get("drafts.settings") as (StoredDoc & Record<string, unknown>) | undefined

describe("parseRulebookCli · what is asked", () => {
  it("asks for the help", () => {
    expect(parseRulebookCli(["--help"])).toEqual({ command: "help" })
    expect(parseRulebookCli(["-h"])).toEqual({ command: "help" })
    expect(parseRulebookCli(["check", "--help"])).toEqual({ command: "help" })
  })

  it("ignores the -- that pnpm puts in front", () => {
    expect(parseRulebookCli(["--", "check", "--rules", "rules.pdf"])).toMatchObject({ command: "check" })
  })

  it("reads the rulebooks to check, one per language, and where to read them from", () => {
    expect(parseRulebookCli(["check", "--rules", "fr=regles.pdf", "--rules", "en=rules.pdf", "--from", "/tmp/rules"])).toEqual({
      command: "check",
      rules: [
        { language: "fr", path: "regles.pdf" },
        { language: "en", path: "rules.pdf" },
      ],
      from: "/tmp/rules",
    })
  })

  it("reads a rulebook without a language as English", () => {
    expect(parseRulebookCli(["check", "--rules", "rules.pdf"])).toMatchObject({ rules: [{ language: "en", path: "rules.pdf" }] })
  })

  it("reads --flag=value as well as --flag value, and keeps an = sign of the value", () => {
    expect(parseRulebookCli(["check", "--rules=fr=regles.pdf", "--from=/tmp/rules"])).toMatchObject({
      rules: [{ language: "fr", path: "regles.pdf" }],
      from: "/tmp/rules",
    })
  })

  it("takes the options of a place with their defaults: a dry run, the production dataset, the env file of the web app", () => {
    expect(parseRulebookCli([...PLACE, "--rules", "rules.pdf"])).toEqual({
      command: "place",
      rules: [{ language: "en", path: "rules.pdf" }],
      from: undefined,
      slug: "hanabi",
      projectId: "ho5ap9a6",
      dataset: "production",
      envFile: "apps/web/.env.local",
      apply: false,
      overwrite: false,
    })
  })

  it("takes every option of a place", () => {
    expect(
      parseRulebookCli([
        "place",
        "--slug=exploding-kittens",
        "--project=iz9kkgyd",
        "--dataset",
        "gam18test",
        "--env-file",
        "./local.env",
        "--from",
        "/tmp/rules",
        "--rules",
        "fr=regles.pdf",
        "--apply",
        "--overwrite",
      ]),
    ).toEqual({
      command: "place",
      rules: [{ language: "fr", path: "regles.pdf" }],
      from: "/tmp/rules",
      slug: "exploding-kittens",
      projectId: "iz9kkgyd",
      dataset: "gam18test",
      envFile: "./local.env",
      apply: true,
      overwrite: true,
    })
  })

  it("accepts --dry-run, which is what a place already does", () => {
    expect(parseRulebookCli([...PLACE, "--rules", "rules.pdf", "--dry-run"])).toMatchObject({ command: "place", apply: false })
  })
})

describe("parseRulebookCli · what is refused", () => {
  const refuses = (argv: string[], message: RegExp) => {
    expect(() => parseRulebookCli(argv)).toThrow(UsageError)
    expect(() => parseRulebookCli(argv)).toThrow(message)
  }

  it("asks what to do when nothing is said", () => {
    refuses([], /Say what to do: check/)
    refuses(["--rules", "rules.pdf"], /Say what to do: check/)
  })

  it("refuses a command that does not exist", () => {
    refuses(["send", "--rules", "rules.pdf"], /Unknown command "send": check or place/)
  })

  it("refuses a second word", () => {
    refuses(["check", "extra", "--rules", "rules.pdf"], /Unexpected argument "extra"/)
  })

  it("refuses an option that does not exist", () => {
    refuses(["check", "--rules", "rules.pdf", "--bogus"], /Unknown option --bogus/)
    refuses(["check", "--rules", "rules.pdf", "-x"], /Unknown option -x/)
  })

  it("refuses an option that is missing its value", () => {
    refuses(["check", "--rules"], /--rules needs a value/)
    refuses(["check", "--rules", "--from", "/tmp"], /--rules needs a value/)
    refuses([...PLACE, "--rules", "rules.pdf", "--dataset"], /--dataset needs a value/)
    refuses(["check", "--rules="], /--rules needs a value/)
  })

  it("refuses an option given twice when it takes one value", () => {
    refuses(["check", "--rules", "rules.pdf", "--from", "/a", "--from", "/b"], /--from is given twice/)
    refuses([...PLACE, "--slug", "other", "--rules", "rules.pdf"], /--slug is given twice/)
  })

  it("refuses --apply together with --dry-run", () => {
    refuses([...PLACE, "--rules", "rules.pdf", "--apply", "--dry-run"], /--apply and --dry-run exclude each other/)
  })

  it("refuses to run with no rulebook", () => {
    refuses(["check"], /No rulebook given: --rules \[<language>=\]<file\.pdf>/)
    refuses(PLACE, /No rulebook given/)
  })

  it("lets a rulebook that cannot be understood say why, in its own error", () => {
    expect(() => parseRulebookCli(["check", "--rules", "xx=rules.pdf"])).toThrow(RulebookError)
    expect(() => parseRulebookCli(["check", "--rules", "xx=rules.pdf"])).toThrow(/"xx" is not a language of the site/)
    expect(() => parseRulebookCli(["check", "--rules", "en=a.pdf", "--rules", "en=b.pdf"])).toThrow(/Two rulebooks for "en"/)
  })

  it.each<[string, string[]]>([
    ["--slug", ["hanabi"]],
    ["--project", ["ho5ap9a6"]],
    ["--dataset", ["production"]],
    ["--env-file", [".env"]],
    ["--apply", []],
    ["--dry-run", []],
    ["--overwrite", []],
  ])("refuses %s for a check, which sends nothing", (flag, value) => {
    refuses(["check", "--rules", "rules.pdf", flag, ...value], new RegExp(`${flag} is for place: check only reads the files and sends nothing`))
  })

  it("asks a place for the game and for its project", () => {
    refuses(["place", "--rules", "rules.pdf", "--project", "ho5ap9a6"], /place needs the game: --slug <slug>/)
    refuses(["place", "--rules", "rules.pdf", "--slug", "hanabi"], /place needs the Sanity project of the game: --project <id>/)
  })

  it("refuses a slug, a project or a dataset that cannot be one", () => {
    refuses(["place", "--rules", "rules.pdf", "--slug", "Hanabi", "--project", "ho5ap9a6"], /"Hanabi" is not a game slug/)
    refuses(["place", "--rules", "rules.pdf", "--slug", "the_crew", "--project", "ho5ap9a6"], /"the_crew" is not a game slug/)
    refuses(["place", "--rules", "rules.pdf", "--slug", "hanabi", "--project", "HO5AP9A6"], /"HO5AP9A6" is not a Sanity project id/)
    refuses([...PLACE, "--rules", "rules.pdf", "--dataset", "Prod Data"], /"Prod Data" is not a Sanity dataset name/)
  })
})

describe("the help", () => {
  it("documents every option the parser knows, and both commands", () => {
    for (const word of ["check", "place", "--rules", "--from", "--slug", "--project", "--dataset", "--env-file", "--dry-run", "--apply", "--overwrite", "--help"]) {
      expect(RULEBOOK_HELP).toContain(word)
    }
  })

  it("says the draft is the end of the road: publishing stays in the Studio", () => {
    expect(RULEBOOK_HELP).toMatch(/Publishing stays a Studio action/)
  })

  it("is printed by --help, with a success code, and asks for no token", async () => {
    const h = harness()
    expect(await h.run(["--help"])).toBe(0)
    expect(h.out).toEqual([RULEBOOK_HELP])
    expect(h.err).toEqual([])
    expect(h.tokens).toEqual([])
    expect(h.connections).toEqual([])
  })
})

describe("runRulebookCli · check", () => {
  it("lists the PDFs, sends nothing and needs no token", async () => {
    const dir = await temp.create({ "regles.pdf": pdf("fr"), "rules.pdf": pdf("en") })
    const h = harness({ cwd: dir })
    expect(await h.run(["check", "--rules", "fr=regles.pdf", "--rules", "en=rules.pdf"])).toBe(0)
    expect(h.out).toHaveLength(1)
    expect(h.out[0]).toContain("Rulebooks read (nothing is sent anywhere):")
    expect(h.out[0]).toMatch(/fr {2}regles\.pdf/)
    expect(h.out[0]).toMatch(/en {2}rules\.pdf/)
    expect(h.err).toEqual([])
    expect(h.tokens).toEqual([])
    expect(h.connections).toEqual([])
    expect(h.store.docs.size).toBe(0)
  })

  it("reads relative paths from the folder it is given, not from where it runs", async () => {
    const rules = await temp.create({ "rules.pdf": pdf("en") })
    const elsewhere = await temp.create()
    const h = harness({ cwd: elsewhere })
    expect(await h.run(["check", "--rules", "rules.pdf"])).toBe(1)
    expect(h.err[0]).toMatch(/^Error: Rulebook en: there is no file at/)
    const again = harness({ cwd: elsewhere })
    expect(await again.run(["check", "--rules", "rules.pdf", "--from", rules])).toBe(0)
    expect(again.out[0]).toContain("rules.pdf")
  })

  it("reads a --from that is itself relative to where it runs", async () => {
    const root = await temp.create()
    const sub = resolve(root, "rules")
    await mkdir(sub)
    await writeFile(resolve(sub, "rules.pdf"), pdf("en"))
    const h = harness({ cwd: root })
    expect(await h.run(["check", "--rules", "rules.pdf", "--from", "rules"])).toBe(0)
  })

  it("says what is wrong with every PDF that cannot be used, and not to look at the help for it", async () => {
    const dir = await temp.create({ "notes.txt": "hello" })
    const h = harness({ cwd: dir })
    expect(await h.run(["check", "--rules", "fr=missing.pdf", "--rules", "es=notes.txt"])).toBe(1)
    expect(h.out).toEqual([])
    expect(h.err).toHaveLength(1)
    const lines = (h.err[0] ?? "").split("\n")
    expect(lines[0]).toMatch(/^Error: Rulebook fr: there is no file at/)
    expect(lines[1]).toMatch(/^Rulebook es: .* is not a PDF/)
    expect(h.err.join("\n")).not.toContain("--help")
  })
})

describe("runRulebookCli · a usage error", () => {
  it("prints the message and where to find the options, and fails", async () => {
    const h = harness()
    expect(await h.run(["check"])).toBe(1)
    expect(h.err).toEqual(["Error: No rulebook given: --rules [<language>=]<file.pdf>", "Run with --help for the options."])
    expect(h.out).toEqual([])
  })

  it("fails on a rulebook argument that makes no sense, without the hint about the options", async () => {
    const h = harness()
    expect(await h.run(["check", "--rules", "xx=rules.pdf"])).toBe(1)
    expect(h.err).toHaveLength(1)
    expect(h.err[0]).toMatch(/^Error: "xx" is not a language of the site/)
  })
})

describe("runRulebookCli · place", () => {
  it("is a dry run unless told to apply: it reads the dataset and writes and uploads nothing", async () => {
    const dir = await temp.create({ "rules.pdf": pdf("en") })
    const h = harness({ cwd: dir })
    expect(await h.run([...PLACE, "--rules", "rules.pdf"])).toBe(0)
    expect(h.out).toHaveLength(1)
    expect(h.out[0]).toContain("Rulebooks · project ho5ap9a6 · dataset production")
    expect(h.out[0]).toContain("DRY RUN: nothing was written or uploaded.")
    expect(h.store.docs.size).toBe(0)
    expect(h.store.writes).toEqual([])
    expect(h.store.fileUploads).toEqual([])
    expect(h.err).toEqual([])
  })

  it("connects to the project and dataset it was given, with the token of the game and the API version of the site", async () => {
    const dir = await temp.create({ "rules.pdf": pdf("en") })
    const h = harness({ cwd: dir })
    await h.run([...PLACE, "--dataset", "gam18test", "--rules", "rules.pdf"])
    expect(h.connections).toEqual([{ projectId: "ho5ap9a6", dataset: "gam18test", apiVersion, token: TOKEN }])
    expect(h.tokens).toEqual([{ slug: "hanabi", envFile: resolve(dir, "apps/web/.env.local") }])
  })

  it("looks for the token in an env file read from where it runs", async () => {
    const dir = await temp.create({ "rules.pdf": pdf("en") })
    const h = harness({ cwd: dir })
    await h.run([...PLACE, "--env-file", "local.env", "--rules", "rules.pdf"])
    expect(h.tokens).toEqual([{ slug: "hanabi", envFile: resolve(dir, "local.env") }])
  })

  it("writes the rulebooks into a draft of the settings and publishes nothing", async () => {
    const dir = await temp.create({ "regles.pdf": pdf("fr"), "rules.pdf": pdf("en") })
    const h = harness({ cwd: dir })
    expect(await h.run([...PLACE, "--rules", "fr=regles.pdf", "--rules", "en=rules.pdf", "--apply"])).toBe(0)
    expect(h.out[0]).toContain("APPLIED: 2 rulebook(s) placed in the draft of Settings (Mechanics tab). Nothing is published.")
    expect(settingsDraft(h.store)).toMatchObject({ _id: "drafts.settings", _type: "settings", rulesPdfFrFile: refOf("fr"), rulesPdfEnFile: refOf("en") })
    expect([...h.store.docs.keys()]).toEqual(["drafts.settings"])
    expect(h.store.fileUploads.map((upload) => upload.filename)).toEqual(["regles.pdf", "rules.pdf"])
  })

  it("does nothing the second time", async () => {
    const dir = await temp.create({ "rules.pdf": pdf("en") })
    const h = harness({ cwd: dir })
    await h.run([...PLACE, "--rules", "rules.pdf", "--apply"])
    expect(await h.run([...PLACE, "--rules", "rules.pdf", "--apply"])).toBe(0)
    expect(h.out.at(-1)).toContain('"Rules PDF (EN)" holds this file already')
    expect(h.store.writes).toHaveLength(1)
    expect(h.store.fileUploads).toHaveLength(1)
  })

  it("keeps the file a field holds, until it is told to replace it", async () => {
    const dir = await temp.create({ "rules.pdf": pdf("en"), "new.pdf": pdf("new") })
    const h = harness({ cwd: dir })
    await h.run([...PLACE, "--rules", "rules.pdf", "--apply"])

    const kept = await h.run([...PLACE, "--rules", "new.pdf", "--apply"])
    expect(kept).toBe(0)
    expect(h.out.at(-1)).toContain('"Rules PDF (EN)" holds another file, kept (--overwrite replaces it)')
    expect(settingsDraft(h.store)?.rulesPdfEnFile).toEqual(refOf("en"))

    expect(await h.run([...PLACE, "--rules", "new.pdf", "--apply", "--overwrite"])).toBe(0)
    expect(h.out.at(-1)).toContain('replaced what "Rules PDF (EN)" held (--overwrite)')
    expect(settingsDraft(h.store)?.rulesPdfEnFile).toEqual(refOf("new"))
  })

  it("checks the PDFs before it asks for a token or connects", async () => {
    const dir = await temp.create()
    const h = harness({ cwd: dir })
    expect(await h.run([...PLACE, "--rules", "missing.pdf", "--apply"])).toBe(1)
    expect(h.err[0]).toMatch(/^Error: Rulebook en: there is no file at/)
    expect(h.tokens).toEqual([])
    expect(h.connections).toEqual([])
    expect(h.store.docs.size).toBe(0)
  })

  it("fails, without connecting, when the token cannot be read, and says where it looked", async () => {
    const dir = await temp.create({ "rules.pdf": pdf("en") })
    const h = harness({
      cwd: dir,
      readToken: () => {
        throw new Error("SANITY_API_WRITE_TOKEN_HANABI is not set (looked in the environment and in apps/web/.env.local)")
      },
    })
    expect(await h.run([...PLACE, "--rules", "rules.pdf", "--apply"])).toBe(1)
    expect(h.err).toEqual(["Error: SANITY_API_WRITE_TOKEN_HANABI is not set (looked in the environment and in apps/web/.env.local)"])
    expect(h.connections).toEqual([])
  })

  it("never prints the token, even when the dataset's error carries it", async () => {
    const dir = await temp.create({ "rules.pdf": pdf("en") })
    const h = harness({ cwd: dir })
    h.store.getDocuments = async () => {
      throw new Error(`Request failed: Bearer ${TOKEN} was refused`)
    }
    expect(await h.run([...PLACE, "--rules", "rules.pdf", "--apply"])).toBe(1)
    expect(h.err).toEqual(["Error: Request failed: Bearer [token] was refused"])
    expect([...h.out, ...h.err].join("\n")).not.toContain(TOKEN)
  })

  it("never prints the token on a success either", async () => {
    const dir = await temp.create({ "rules.pdf": pdf("en") })
    const h = harness({ cwd: dir })
    await h.run([...PLACE, "--rules", "rules.pdf", "--apply"])
    expect([...h.out, ...h.err].join("\n")).not.toContain(TOKEN)
  })
})
