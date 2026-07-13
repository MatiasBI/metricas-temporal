import { createHash } from "crypto"
import { createReadStream, promises as fs } from "fs"
import path from "path"
import { Readable } from "stream"
import { promisify } from "util"
import { gzip as gzipCallback } from "zlib"
import { loadEnvConfig } from "@next/env"
import { parse } from "csv-parse"

import {
  METRICAS_CSV_COLUMN_COUNT,
  parseMetricasCsvRow,
  type MetricasCsvNormalizedRow,
  type MetricasDatasetKey,
} from "../src/lib/metricas-csv"

loadEnvConfig(process.cwd())

const gzip = promisify(gzipCallback)
const CSV_PATH = process.env.METRICAS_CSV_PATH
const CSV_URL = process.env.METRICAS_CSV_URL
const CSV_DELIMITER = process.env.METRICAS_CSV_DELIMITER || "|"
const OUT_DIR = path.resolve(
  process.env.METRICAS_ETL_OUT_DIR || path.join("data", "metricas-etl")
)
const MIN_ROWS: Record<MetricasDatasetKey, number> = {
  alumbrado: Number(process.env.METRICAS_ETL_MIN_ALUMBRADO_ROWS || 200_000),
  "paisaje-urbano": Number(
    process.env.METRICAS_ETL_MIN_PAISAJE_URBANO_ROWS || 5_000
  ),
}

type PersistedRow = Omit<MetricasCsvNormalizedRow, "fecha"> & {
  fecha: string | null
}

type Snapshot = {
  rows: PersistedRow[]
  filtros: {
    years: string[]
    prestaciones: string[]
    categorias: string[]
    comunas: string[]
    barrios: string[]
  }
}

type DatasetManifest = {
  file: string
  rows: number
  bytes: number
  uncompressedBytes: number
  sha256: string
  uncompressedSha256: string
  minDate: string | null
  maxDate: string | null
  states: Record<string, number>
}

type MetricasManifest = {
  schemaVersion: 1
  generatedAt: string
  source: {
    kind: "file" | "url"
    location: string
    bytes: number | null
    modifiedAt: string | null
    physicalRows: number
    dataRows: number
  }
  datasets: Record<MetricasDatasetKey, DatasetManifest>
}

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex")
}

function safeRemoteLocation(value: string) {
  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname}`
  } catch {
    return "URL configurada"
  }
}

async function getSourceMetadata() {
  if (CSV_URL) {
    return {
      kind: "url" as const,
      location: safeRemoteLocation(CSV_URL),
      bytes: null,
      modifiedAt: null,
    }
  }

  if (!CSV_PATH) {
    throw new Error("Configura METRICAS_CSV_PATH o METRICAS_CSV_URL")
  }

  const stat = await fs.stat(CSV_PATH)
  return {
    kind: "file" as const,
    location: path.basename(CSV_PATH),
    bytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
  }
}

async function createInputStream() {
  if (!CSV_URL) {
    if (!CSV_PATH) {
      throw new Error("Configura METRICAS_CSV_PATH o METRICAS_CSV_URL")
    }
    return createReadStream(CSV_PATH)
  }

  const response = await fetchDownloadResponse(CSV_URL)
  if (!response.ok || !response.body) {
    throw new Error(`No se pudo descargar el CSV: ${response.status}`)
  }

  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("text/html")) {
    throw new Error("La URL devolvio HTML; usa un enlace descargable directo")
  }

  return Readable.fromWeb(response.body as import("stream/web").ReadableStream)
}

function resolveDownloadUrl(url: string) {
  const match = url.match(/drive\.google\.com\/file\/d\/([^/]+)/)
  return match
    ? `https://drive.google.com/uc?export=download&id=${match[1]}`
    : url
}

async function fetchDownloadResponse(url: string) {
  const response = await fetch(resolveDownloadUrl(url))
  const contentType = response.headers.get("content-type") ?? ""
  if (!url.includes("drive.google.com") || !contentType.includes("text/html")) {
    return response
  }

  const html = await response.text()
  const actionMatch = html.match(
    /<form[^>]+id="download-form"[^>]+action="([^"]+)"/
  )
  if (!actionMatch) return response

  const params = new URLSearchParams()
  const inputPattern =
    /<input[^>]+type="hidden"[^>]+name="([^"]+)"[^>]+value="([^"]*)"/g
  let inputMatch: RegExpExecArray | null

  while ((inputMatch = inputPattern.exec(html))) {
    params.set(decodeHtml(inputMatch[1]), decodeHtml(inputMatch[2]))
  }

  return fetch(`${decodeHtml(actionMatch[1])}?${params.toString()}`, {
    headers: { cookie: response.headers.get("set-cookie") ?? "" },
  })
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
}

function buildSnapshot(rows: MetricasCsvNormalizedRow[]) {
  const years = new Set<string>()
  const prestaciones = new Set<string>()
  const categorias = new Set<string>()
  const comunas = new Set<string>()
  const barrios = new Set<string>()
  const states: Record<string, number> = {}
  let minDate: string | null = null
  let maxDate: string | null = null

  for (const row of rows) {
    if (row.fecha) {
      const date = row.fecha.toISOString().slice(0, 10)
      years.add(String(row.fecha.getUTCFullYear()))
      minDate = !minDate || date < minDate ? date : minDate
      maxDate = !maxDate || date > maxDate ? date : maxDate
    }
    if (row.prestacion) prestaciones.add(row.prestacion)
    if (row.categoria) categorias.add(row.categoria)
    if (row.comuna) comunas.add(row.comuna)
    if (row.barrio) barrios.add(row.barrio)
    const state = row.estado ?? "sin_estado"
    states[state] = (states[state] ?? 0) + 1
  }

  const snapshot: Snapshot = {
    rows: rows.map((row) => ({
      ...row,
      fecha: row.fecha?.toISOString() ?? null,
    })),
    filtros: {
      years: Array.from(years).sort(),
      prestaciones: Array.from(prestaciones).sort(),
      categorias: Array.from(categorias).sort(),
      comunas: Array.from(comunas).sort(),
      barrios: Array.from(barrios).sort(),
    },
  }

  return { snapshot, minDate, maxDate, states }
}

async function writeDataset(
  datasetKey: MetricasDatasetKey,
  rows: MetricasCsvNormalizedRow[],
  version: string
) {
  if (rows.length < MIN_ROWS[datasetKey]) {
    throw new Error(
      `${datasetKey} contiene ${rows.length} filas; minimo esperado: ${MIN_ROWS[datasetKey]}`
    )
  }

  const { snapshot, minDate, maxDate, states } = buildSnapshot(rows)
  const json = JSON.stringify(snapshot)
  const compressed = await gzip(Buffer.from(json, "utf8"), { level: 9 })
  const digest = sha256(compressed)
  const file = `metricas-${datasetKey}-dataset.${version}.${digest.slice(0, 12)}.json.gz`

  await fs.writeFile(path.join(OUT_DIR, file), compressed, { flag: "wx" })

  return {
    file,
    rows: rows.length,
    bytes: compressed.length,
    uncompressedBytes: Buffer.byteLength(json),
    sha256: digest,
    uncompressedSha256: sha256(json),
    minDate,
    maxDate,
    states,
  } satisfies DatasetManifest
}

async function replaceManifest(manifest: MetricasManifest) {
  const target = path.join(OUT_DIR, "metricas-manifest.json")
  const temporary = `${target}.${process.pid}.tmp`
  await fs.writeFile(temporary, JSON.stringify(manifest, null, 2), "utf8")

  try {
    await fs.rename(temporary, target)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== "EEXIST" && code !== "EPERM") throw error
    await fs.rm(target, { force: true })
    await fs.rename(temporary, target)
  }
}

async function main() {
  const source = await getSourceMetadata()
  const rowsByDataset: Record<
    MetricasDatasetKey,
    MetricasCsvNormalizedRow[]
  > = {
    alumbrado: [],
    "paisaje-urbano": [],
  }
  let physicalRows = 0
  let dataRows = 0

  const input = await createInputStream()
  const parser = parse({
    delimiter: CSV_DELIMITER,
    from_line: 1,
    relax_column_count: true,
    quote: false,
    encoding: "latin1",
  })

  for await (const rawRow of input.pipe(parser) as AsyncIterable<string[]>) {
    physicalRows += 1
    if (rawRow.length === METRICAS_CSV_COLUMN_COUNT) dataRows += 1
    const parsedRow = parseMetricasCsvRow(rawRow)
    if (!parsedRow) continue
    rowsByDataset[parsedRow.datasetKey].push(parsedRow.row)
  }

  if (!dataRows) {
    throw new Error(
      `No se encontraron filas de ${METRICAS_CSV_COLUMN_COUNT} columnas`
    )
  }

  await fs.mkdir(OUT_DIR, { recursive: true })
  const generatedAt = new Date()
  const version = generatedAt
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
  const [alumbrado, paisajeUrbano] = await Promise.all([
    writeDataset("alumbrado", rowsByDataset.alumbrado, version),
    writeDataset("paisaje-urbano", rowsByDataset["paisaje-urbano"], version),
  ])
  const manifest: MetricasManifest = {
    schemaVersion: 1,
    generatedAt: generatedAt.toISOString(),
    source: { ...source, physicalRows, dataRows },
    datasets: {
      alumbrado,
      "paisaje-urbano": paisajeUrbano,
    },
  }

  await replaceManifest(manifest)

  console.log(`ETL publicada en ${OUT_DIR}`)
  console.log(
    `alumbrado: ${alumbrado.rows.toLocaleString("es-AR")} filas, ${(alumbrado.bytes / 1024 / 1024).toFixed(2)} MB`
  )
  console.log(
    `paisaje-urbano: ${paisajeUrbano.rows.toLocaleString("es-AR")} filas, ${(paisajeUrbano.bytes / 1024).toFixed(0)} KB`
  )
}

main().catch((error) => {
  console.error("La ETL de metricas fallo; se conserva la version anterior")
  console.error(error)
  process.exit(1)
})
