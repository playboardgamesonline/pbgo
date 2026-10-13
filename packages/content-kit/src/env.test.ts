import { mkdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { parseEnv, readToken } from "./env.ts"
import { TempFolders } from "./test-fixtures.ts"

const temp = new TempFolders()
afterEach(() => temp.cleanUp())

describe("parseEnv", () => {
  it("reads KEY=value lines", () => {
    expect(parseEnv("A=1\nB=two")).toEqual({ A: "1", B: "two" })
  })

  it("ignores comments and blank lines", () => {
    expect(parseEnv("# a comment\n\n   \nA=1\n  # indented comment\n")).toEqual({ A: "1" })
  })

  it("understands the export prefix", () => {
    expect(parseEnv("export A=1\nexport   B=2")).toEqual({ A: "1", B: "2" })
  })

  it("strips the quotes around a value, and only matching ones", () => {
    expect(parseEnv(`A="one two"\nB='three'\nC="open\nD='mixed"`)).toEqual({ A: "one two", B: "three", C: '"open', D: "'mixed\"" })
  })

  it("keeps a # inside quotes and drops a trailing comment outside", () => {
    expect(parseEnv(`A="x # y"\nB=x # y\nC=x#y`)).toEqual({ A: "x # y", B: "x", C: "x#y" })
  })

  it("keeps the equal signs of a value", () => {
    expect(parseEnv("A=b=c==")).toEqual({ A: "b=c==" })
  })

  it("reads an empty value", () => {
    expect(parseEnv("A=\nB=''")).toEqual({ A: "", B: "" })
  })

  it("reads CRLF files", () => {
    expect(parseEnv("A=1\r\nB=2\r\n")).toEqual({ A: "1", B: "2" })
  })

  it("skips a line without a key or without a sign", () => {
    expect(parseEnv("=orphan\nnot a pair\nA=1")).toEqual({ A: "1" })
  })

  it("lets the last line win", () => {
    expect(parseEnv("A=1\nA=2")).toEqual({ A: "2" })
  })

  it("trims the spaces around the key and the value", () => {
    expect(parseEnv("  A  =  1  ")).toEqual({ A: "1" })
  })

  it("returns nothing for an empty file", () => {
    expect(parseEnv("")).toEqual({})
  })
})

describe("readToken", () => {
  const NAME = "SANITY_API_WRITE_TOKEN_SKYJO"
  const SECRET = "sk-test-secret-value-1234567890"

  const fileWith = async (content: string) => join(await temp.create({ ".env.local": content }), ".env.local")

  it("reads the token of the game from the environment", async () => {
    const envFile = await fileWith("")
    expect(readToken({ slug: "skyjo", envFile, env: { [NAME]: SECRET } })).toBe(SECRET)
  })

  it("trims it", async () => {
    const envFile = await fileWith("")
    expect(readToken({ slug: "skyjo", envFile, env: { [NAME]: `  ${SECRET}\n` } })).toBe(SECRET)
  })

  it("reads it from the env file when the environment has none", async () => {
    const envFile = await fileWith(`OTHER=1\n${NAME}="${SECRET}"\n`)
    expect(readToken({ slug: "skyjo", envFile, env: {} })).toBe(SECRET)
  })

  it("prefers the environment to the file", async () => {
    const envFile = await fileWith(`${NAME}=from-the-file`)
    expect(readToken({ slug: "skyjo", envFile, env: { [NAME]: "from-the-environment" } })).toBe("from-the-environment")
  })

  it("falls back to the file when the variable of the environment is empty", async () => {
    const envFile = await fileWith(`${NAME}=from-the-file`)
    expect(readToken({ slug: "skyjo", envFile, env: { [NAME]: "   " } })).toBe("from-the-file")
  })

  it("uses the variable of the game, not another game's", async () => {
    const envFile = await fileWith(`SANITY_API_WRITE_TOKEN_COURTISANS=not-mine\n${NAME}=mine`)
    expect(readToken({ slug: "skyjo", envFile, env: {} })).toBe("mine")
    expect(() => readToken({ slug: "skyjo", envFile, env: { SANITY_API_WRITE_TOKEN_COURTISANS: "not-mine" } })).not.toThrow()
    const onlyOthers = await fileWith("SANITY_API_WRITE_TOKEN_COURTISANS=not-mine")
    expect(() => readToken({ slug: "skyjo", envFile: onlyOthers, env: { SANITY_API_WRITE_TOKEN_COURTISANS: "not-mine" } })).toThrow(`${NAME} is not set`)
  })

  it("names the variable of a slug with a dash the way the admin does", async () => {
    const envFile = await fileWith("SANITY_API_WRITE_TOKEN_6_NIMMT=six")
    expect(readToken({ slug: "6-nimmt", envFile, env: {} })).toBe("six")
  })

  describe("when there is no token", () => {
    it("says which variable is missing and where it looked", async () => {
      const envFile = await fileWith("OTHER=1")
      expect(() => readToken({ slug: "skyjo", envFile, env: {} })).toThrow(`${NAME} is not set (looked in the environment and in ${envFile})`)
    })

    it("treats a missing env file as an empty one", async () => {
      const envFile = join(await temp.create(), "absent.env")
      expect(() => readToken({ slug: "skyjo", envFile, env: {} })).toThrow(`${NAME} is not set`)
    })

    it("does not accept an empty value in the file", async () => {
      const envFile = await fileWith(`${NAME}=`)
      expect(() => readToken({ slug: "skyjo", envFile, env: {} })).toThrow("is not set")
    })

    it("says so when the file cannot be read, without hiding it behind a missing token", async () => {
      const dir = await temp.create()
      await mkdir(join(dir, "folder.env"))
      expect(() => readToken({ slug: "skyjo", envFile: join(dir, "folder.env"), env: {} })).toThrow(`Cannot read ${join(dir, "folder.env")}`)
    })
  })

  describe("the value is never echoed", () => {
    it("is not in the message of an unreadable file", async () => {
      const dir = await temp.create()
      await mkdir(join(dir, "folder.env"))
      const error = (() => {
        try {
          readToken({ slug: "skyjo", envFile: join(dir, "folder.env"), env: { OTHER: SECRET } })
        } catch (caught) {
          return caught as Error
        }
        return undefined
      })()
      expect(error?.message).not.toContain(SECRET)
    })

    it("is not in the message when another variable of the file holds it", async () => {
      const envFile = await fileWith(`SOMETHING_ELSE=${SECRET}`)
      const error = (() => {
        try {
          readToken({ slug: "skyjo", envFile, env: {} })
        } catch (caught) {
          return caught as Error
        }
        return undefined
      })()
      expect(error?.message).toContain("is not set")
      expect(error?.message).not.toContain(SECRET)
    })

    it("leaves the file it reads as it was", async () => {
      const envFile = await fileWith(`${NAME}=${SECRET}`)
      readToken({ slug: "skyjo", envFile, env: {} })
      expect(await readFile(envFile, "utf8")).toBe(`${NAME}=${SECRET}`)
    })
  })

  it("uses the process environment by default", async () => {
    const envFile = await fileWith("")
    const previous = process.env[NAME]
    process.env[NAME] = "from-process"
    try {
      expect(readToken({ slug: "skyjo", envFile })).toBe("from-process")
    } finally {
      if (previous === undefined) delete process.env[NAME]
      else process.env[NAME] = previous
    }
  })
})
