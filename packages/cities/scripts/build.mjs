// Builds `data/cities.json` from two files of GeoNames (https://www.geonames.org, licensed CC BY 4.0, https://creativecommons.org/licenses/by/4.0/):
//   node scripts/build.mjs <cities5000.txt> <admin1CodesASCII.txt> <out.json> [--min-population <n>]
// Both are in https://download.geonames.org/export/dump/ (`cities5000.zip` holds the first). The files are read, never run. A city is a populated place (feature class P) of at least
// `--min-population` inhabitants (5000 by default) or a capital or a seat of a first-level division, without the sections of a city, the historical, destroyed, abandoned and religious places. Each
// is kept as [geonameid, name, country code, index of its first-level division in `regions` (-1 for none), population], the most populated first, one per line so that a new file diffs well.

import { readFileSync, writeFileSync } from "node:fs"

const [citiesPath, regionsPath, outPath, ...flags] = process.argv.slice(2)
if (!citiesPath || !regionsPath || !outPath) {
  console.error("usage: node scripts/build.mjs <cities5000.txt> <admin1CodesASCII.txt> <out.json> [--min-population <n>]")
  process.exit(1)
}
const at = flags.indexOf("--min-population")
const minPopulation = at >= 0 ? Number(flags[at + 1]) : 5000
if (!Number.isInteger(minPopulation) || minPopulation < 0) throw new Error("--min-population is a whole number")

// "FR.84" -> "Auvergne-Rhône-Alpes"
const divisionNames = new Map(
  readFileSync(regionsPath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [code, name] = line.split("\t")
      return [code, name]
    }),
)

const SKIPPED = new Set(["PPLX", "PPLH", "PPLW", "PPLQ", "PPLR"])
const SEATS = new Set(["PPLC", "PPLA"])
const regions = []
const regionIndex = new Map()
const rows = []
for (const line of readFileSync(citiesPath, "utf8").split("\n")) {
  if (line === "") continue
  const columns = line.split("\t")
  const [id, name, , , , , featureClass, featureCode, country, , division, , , , population] = columns
  if (featureClass !== "P" || SKIPPED.has(featureCode) || !/^[A-Z]{2}$/.test(country)) continue
  const inhabitants = Number(population)
  if (inhabitants < minPopulation && !SEATS.has(featureCode)) continue
  const divisionName = divisionNames.get(`${country}.${division}`)
  let index = -1
  if (divisionName) {
    if (!regionIndex.has(divisionName)) {
      regionIndex.set(divisionName, regions.length)
      regions.push(divisionName)
    }
    index = regionIndex.get(divisionName)
  }
  rows.push([Number(id), name, country, index, inhabitants])
}
rows.sort((a, b) => b[4] - a[4] || a[1].localeCompare(b[1]) || a[0] - b[0])
const json = `{"regions":${JSON.stringify(regions)},"cities":[\n${rows.map((row) => JSON.stringify(row)).join(",\n")}\n]}\n`
writeFileSync(outPath, json)
console.log(`${rows.length} cities, ${regions.length} divisions, ${(json.length / 1024 / 1024).toFixed(2)} MB (minimum population ${minPopulation})`)
