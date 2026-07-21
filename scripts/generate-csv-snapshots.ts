import { createReadStream, promises as fs } from "fs"
import path from "path"
import { Readable } from "stream"
import { parse } from "csv-parse"

import {
  METRICAS_DATASET_KEYS,
  METRICAS_CSV_COLUMN_COUNT,
  parseMetricasCsvRow,
  type MetricasCsvNormalizedRow,
  type MetricasDatasetKey,
} from "../src/lib/metricas-csv"

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

const CSV_PATH = process.env.METRICAS_CSV_PATH
const CSV_URL = process.env.METRICAS_CSV_URL
const CSV_DELIMITER = process.env.METRICAS_CSV_DELIMITER || "|"
const OUT_DIR = path.join(process.cwd(), "src", "data", "metricas-demo")

function buildSnapshot(rows: MetricasCsvNormalizedRow[]): Snapshot {
  const years = new Set<string>()
  const prestaciones = new Set<string>()
  const categorias = new Set<string>()
  const comunas = new Set<string>()
  const barrios = new Set<string>()

  for (const row of rows) {
    if (row.fecha) years.add(String(row.fecha.getUTCFullYear()))
    if (row.prestacion) prestaciones.add(row.prestacion)
    if (row.categoria) categorias.add(row.categoria)
    if (row.comuna) comunas.add(row.comuna)
    if (row.barrio) barrios.add(row.barrio)
  }

  return {
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
    throw new Error("La URL configurada devolvio HTML; usa un link descargable")
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

async function main() {
  const rowsByDataset = Object.fromEntries(
    METRICAS_DATASET_KEYS.map((datasetKey) => [datasetKey, []])
  ) as Record<MetricasDatasetKey, MetricasCsvNormalizedRow[]>
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

  for (const [datasetKey, rows] of Object.entries(rowsByDataset) as Array<
    [MetricasDatasetKey, MetricasCsvNormalizedRow[]]
  >) {
    const fileName = `${datasetKey}-dataset.json`
    await fs.writeFile(
      path.join(OUT_DIR, fileName),
      JSON.stringify(buildSnapshot(rows)),
      "utf8"
    )
    console.log(`${datasetKey}: ${rows.length.toLocaleString("es-AR")} filas`)
  }

  console.log(`Filas fisicas: ${physicalRows.toLocaleString("es-AR")}`)
  console.log(`Filas de datos: ${dataRows.toLocaleString("es-AR")}`)
}

main().catch((error) => {
  console.error("No se pudieron generar los snapshots desde el CSV")
  console.error(error)
  process.exit(1)
})
