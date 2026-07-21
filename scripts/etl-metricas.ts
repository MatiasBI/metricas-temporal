import { createHash } from "crypto"
import { createReadStream, promises as fs } from "fs"
import path from "path"
import { Readable } from "stream"
import { promisify } from "util"
import { gzip as gzipCallback } from "zlib"
import { loadEnvConfig } from "@next/env"
import { parse } from "csv-parse"

import {
  METRICAS_DATASET_KEYS,
  METRICAS_CSV_COLUMN_COUNT,
  getUnclassifiedMetricasCsvStatus,
  parseMetricasCsvRow,
  type MantenimientoDatasetKey,
  type MetricasCsvNormalizedRow,
  type MetricasDatasetKey,
} from "../src/lib/metricas-csv"
import {
  FLUJO_MOTIVOS_BAJA,
  parseFlujoMantenimientoCsvRow,
  type FlujoCsvRow,
} from "../src/lib/flujo-mantenimiento-csv"

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
  "calzada-emui": Number(
    process.env.METRICAS_ETL_MIN_CALZADA_EMUI_ROWS || 150_000
  ),
  "mobiliario-urbano": Number(
    process.env.METRICAS_ETL_MIN_MOBILIARIO_URBANO_ROWS || 8_000
  ),
  pluviales: Number(process.env.METRICAS_ETL_MIN_PLUVIALES_ROWS || 30_000),
  "vias-peatonales": Number(
    process.env.METRICAS_ETL_MIN_VIAS_PEATONALES_ROWS || 150_000
  ),
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
    discardedStatuses: Record<string, number>
  }
  datasets: Record<MetricasDatasetKey, DatasetManifest>
  flujoMantenimiento: DatasetManifest
}

type FlujoMonthSnapshot = {
  mes: string
  ingresos: number
  bajas: number
  pendientes: number
  resueltos: number
  denegados: number
  motivosBaja: Record<string, number>
  ingresosPorPrestacion: Record<string, number>
  pendientesPorPrestacion: Record<string, number>
}

type FlujoSnapshot = {
  schemaVersion: 1
  generatedAt: string
  records: number
  areas: Record<MantenimientoDatasetKey, FlujoMonthSnapshot[]>
}

type FlujoMonthAccumulator = Omit<
  FlujoMonthSnapshot,
  "mes" | "pendientes" | "pendientesPorPrestacion"
>

type FlujoAreaAccumulator = {
  months: Map<number, FlujoMonthAccumulator>
  pendingDeltas: Map<number, number>
  pendingPrestacionDeltas: Map<number, Map<string, number>>
}

const FLOW_DATASET_KEYS: MantenimientoDatasetKey[] = [
  "alumbrado",
  "calzada-emui",
  "mobiliario-urbano",
  "pluviales",
  "vias-peatonales",
]

function createFlujoAreaAccumulator(): FlujoAreaAccumulator {
  return {
    months: new Map(),
    pendingDeltas: new Map(),
    pendingPrestacionDeltas: new Map(),
  }
}

function monthIndex(date: Date) {
  return date.getUTCFullYear() * 12 + date.getUTCMonth()
}

function formatMonth(index: number) {
  const year = Math.floor(index / 12)
  const month = (index % 12) + 1
  return `${year}-${String(month).padStart(2, "0")}`
}

function incrementRecord(
  record: Record<string, number>,
  key: string,
  amount = 1
) {
  record[key] = (record[key] ?? 0) + amount
}

function getFlujoMonth(
  area: FlujoAreaAccumulator,
  index: number
): FlujoMonthAccumulator {
  const existing = area.months.get(index)
  if (existing) return existing

  const created: FlujoMonthAccumulator = {
    ingresos: 0,
    bajas: 0,
    resueltos: 0,
    denegados: 0,
    motivosBaja: {},
    ingresosPorPrestacion: {},
  }
  area.months.set(index, created)
  return created
}

function addPendingDelta(
  area: FlujoAreaAccumulator,
  index: number,
  prestacion: string,
  amount: number
) {
  area.pendingDeltas.set(index, (area.pendingDeltas.get(index) ?? 0) + amount)
  const byPrestacion = area.pendingPrestacionDeltas.get(index) ?? new Map()
  byPrestacion.set(prestacion, (byPrestacion.get(prestacion) ?? 0) + amount)
  area.pendingPrestacionDeltas.set(index, byPrestacion)
}

function addFlujoRow(
  accumulators: Record<MantenimientoDatasetKey, FlujoAreaAccumulator>,
  row: FlujoCsvRow
) {
  const area = accumulators[row.datasetKey]
  const ingresoIndex = monthIndex(row.fechaIngreso)
  const ingreso = getFlujoMonth(area, ingresoIndex)
  ingreso.ingresos += 1
  incrementRecord(ingreso.ingresosPorPrestacion, row.prestacion)

  if (row.estado === "pendientes") {
    addPendingDelta(area, ingresoIndex, row.prestacion, 1)
    return { min: ingresoIndex, max: ingresoIndex }
  }

  if (!row.fechaBaja || row.fechaBaja < row.fechaIngreso) {
    return { min: ingresoIndex, max: ingresoIndex }
  }

  const bajaIndex = monthIndex(row.fechaBaja)
  const baja = getFlujoMonth(area, bajaIndex)
  baja.bajas += 1
  baja[row.estado] += 1
  incrementRecord(
    baja.motivosBaja,
    FLUJO_MOTIVOS_BAJA[row.statusUsuario] ?? row.statusUsuario
  )
  addPendingDelta(area, ingresoIndex, row.prestacion, 1)
  addPendingDelta(area, bajaIndex, row.prestacion, -1)

  return {
    min: Math.min(ingresoIndex, bajaIndex),
    max: Math.max(ingresoIndex, bajaIndex),
  }
}

function buildFlujoSnapshot(
  accumulators: Record<MantenimientoDatasetKey, FlujoAreaAccumulator>,
  generatedAt: Date,
  records: number,
  minMonth: number,
  maxMonth: number
): FlujoSnapshot {
  const areas = {} as Record<MantenimientoDatasetKey, FlujoMonthSnapshot[]>

  for (const datasetKey of FLOW_DATASET_KEYS) {
    const area = accumulators[datasetKey]
    const months: FlujoMonthSnapshot[] = []
    const pendingByPrestacion = new Map<string, number>()
    let pending = 0

    for (let index = minMonth; index <= maxMonth; index += 1) {
      pending += area.pendingDeltas.get(index) ?? 0

      const prestacionDeltas = area.pendingPrestacionDeltas.get(index)
      if (prestacionDeltas) {
        for (const [prestacion, delta] of Array.from(prestacionDeltas.entries())) {
          const next = (pendingByPrestacion.get(prestacion) ?? 0) + delta
          if (next > 0) pendingByPrestacion.set(prestacion, next)
          else pendingByPrestacion.delete(prestacion)
        }
      }

      const activity = area.months.get(index)
      months.push({
        mes: formatMonth(index),
        ingresos: activity?.ingresos ?? 0,
        bajas: activity?.bajas ?? 0,
        pendientes: Math.max(0, pending),
        resueltos: activity?.resueltos ?? 0,
        denegados: activity?.denegados ?? 0,
        motivosBaja: activity?.motivosBaja ?? {},
        ingresosPorPrestacion: activity?.ingresosPorPrestacion ?? {},
        pendientesPorPrestacion: Object.fromEntries(pendingByPrestacion),
      })
    }

    areas[datasetKey] = months
  }

  return {
    schemaVersion: 1,
    generatedAt: generatedAt.toISOString(),
    records,
    areas,
  }
}

async function writeFlujoSnapshot(
  snapshot: FlujoSnapshot,
  version: string,
  minMonth: number,
  maxMonth: number
) {
  const json = JSON.stringify(snapshot)
  const compressed = await gzip(Buffer.from(json, "utf8"), { level: 9 })
  const digest = sha256(compressed)
  const file = `flujo-mantenimiento-dataset.${version}.${digest.slice(0, 12)}.json.gz`

  await fs.writeFile(path.join(OUT_DIR, file), compressed, { flag: "wx" })

  return {
    file,
    rows: snapshot.records,
    bytes: compressed.length,
    uncompressedBytes: Buffer.byteLength(json),
    sha256: digest,
    uncompressedSha256: sha256(json),
    minDate: `${formatMonth(minMonth)}-01`,
    maxDate: `${formatMonth(maxMonth)}-01`,
    states: {},
  } satisfies DatasetManifest
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
  const rowsByDataset = Object.fromEntries(
    METRICAS_DATASET_KEYS.map((datasetKey) => [datasetKey, []])
  ) as Record<MetricasDatasetKey, MetricasCsvNormalizedRow[]>
  const discardedStatuses: Record<string, number> = {}
  const flujoAccumulators = Object.fromEntries(
    FLOW_DATASET_KEYS.map((datasetKey) => [
      datasetKey,
      createFlujoAreaAccumulator(),
    ])
  ) as Record<MantenimientoDatasetKey, FlujoAreaAccumulator>
  let physicalRows = 0
  let dataRows = 0
  let flujoRows = 0
  let flujoMinMonth = Number.POSITIVE_INFINITY
  let flujoMaxMonth = Number.NEGATIVE_INFINITY

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
    const flujoRow = parseFlujoMantenimientoCsvRow(rawRow)
    if (flujoRow) {
      const bounds = addFlujoRow(flujoAccumulators, flujoRow)
      flujoRows += 1
      flujoMinMonth = Math.min(flujoMinMonth, bounds.min)
      flujoMaxMonth = Math.max(flujoMaxMonth, bounds.max)
    }
    const parsedRow = parseMetricasCsvRow(rawRow)
    if (!parsedRow) {
      const status = getUnclassifiedMetricasCsvStatus(rawRow)
      if (status) {
        discardedStatuses[status] = (discardedStatuses[status] ?? 0) + 1
      }
      continue
    }
    rowsByDataset[parsedRow.datasetKey].push(parsedRow.row)
  }

  if (!dataRows) {
    throw new Error(
      `No se encontraron filas de ${METRICAS_CSV_COLUMN_COUNT} columnas`
    )
  }
  if (
    !flujoRows ||
    !Number.isFinite(flujoMinMonth) ||
    !Number.isFinite(flujoMaxMonth)
  ) {
    throw new Error("No se encontraron filas para el flujo de mantenimiento")
  }

  await fs.mkdir(OUT_DIR, { recursive: true })
  const generatedAt = new Date()
  const version = generatedAt
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
  const datasets = {} as Record<MetricasDatasetKey, DatasetManifest>
  for (const datasetKey of METRICAS_DATASET_KEYS) {
    datasets[datasetKey] = await writeDataset(
      datasetKey,
      rowsByDataset[datasetKey],
      version
    )
    rowsByDataset[datasetKey] = []
  }

  const flujoMantenimiento = await writeFlujoSnapshot(
    buildFlujoSnapshot(
      flujoAccumulators,
      generatedAt,
      flujoRows,
      flujoMinMonth,
      flujoMaxMonth
    ),
    version,
    flujoMinMonth,
    flujoMaxMonth
  )

  const manifest: MetricasManifest = {
    schemaVersion: 1,
    generatedAt: generatedAt.toISOString(),
    source: { ...source, physicalRows, dataRows, discardedStatuses },
    datasets,
    flujoMantenimiento,
  }

  await replaceManifest(manifest)

  console.log(`ETL publicada en ${OUT_DIR}`)
  for (const datasetKey of METRICAS_DATASET_KEYS) {
    const dataset = datasets[datasetKey]
    console.log(
      `${datasetKey}: ${dataset.rows.toLocaleString("es-AR")} filas, ${(dataset.bytes / 1024 / 1024).toFixed(2)} MB`
    )
  }
  console.log(
    `flujo-mantenimiento: ${flujoMantenimiento.rows.toLocaleString("es-AR")} filas fuente, ${(flujoMantenimiento.bytes / 1024 / 1024).toFixed(2)} MB`
  )
  console.log(`Estados descartados: ${JSON.stringify(discardedStatuses)}`)
}

main().catch((error) => {
  console.error("La ETL de metricas fallo; se conserva la version anterior")
  console.error(error)
  process.exit(1)
})
