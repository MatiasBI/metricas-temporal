import { createHash } from "crypto"
import { promises as fs } from "fs"
import path from "path"
import { promisify } from "util"
import { gunzip as gunzipCallback } from "zlib"

import {
  MANTENIMIENTO_DATASET_KEYS,
  type MantenimientoDatasetKey,
} from "./metricas-csv"

export type FlujoMonthSnapshot = {
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

type ManifestEntry = {
  file: string
  bytes: number
  sha256: string
}

type EtlManifest = {
  schemaVersion: number
  flujoMantenimiento?: ManifestEntry
}

export type FlujoFilters = {
  years?: string[]
  months?: string[]
  areas?: string[]
}

export type FlujoMantenimientoPayload = {
  resumen: {
    ingresos: number
    bajas: number
    pendientes: number
    resueltos: number
    denegados: number
    generado: string
    stockMes: string | null
  }
  por_mes: Array<{
    mes: string
    ingresos: number
    bajas: number
    pendientes: number
  }>
  flujo_bajas: Array<{
    nombre: "Resueltos" | "Denegados"
    cantidad: number
    porcentaje: number
  }>
  motivos_baja: Array<{
    motivo: string
    cantidad: number
    porcentaje: number
  }>
  pendientes_por_area: Array<{
    area: string
    cantidad: number
    porcentaje: number
  }>
  top_ingresos_prestacion: Array<{
    prestacion: string
    cantidad: number
  }>
  top_pendientes_prestacion: Array<{
    prestacion: string
    cantidad: number
  }>
  filtros: {
    years: string[]
    months: string[]
    areas: Array<{ value: MantenimientoDatasetKey; label: string }>
    selectedYears: string[]
    selectedMonths: string[]
    selectedAreas: MantenimientoDatasetKey[]
  }
}

export const FLUJO_AREA_LABELS: Record<MantenimientoDatasetKey, string> = {
  alumbrado: "Alumbrado",
  "calzada-emui": "Calzada - EMUI",
  "mobiliario-urbano": "Mobiliario Urbano",
  pluviales: "Pluviales",
  "vias-peatonales": "Vías Peatonales",
}

const gunzip = promisify(gunzipCallback)
const CACHE_TTL_MS = 15 * 60 * 1000
const SNAPSHOT_DIR = process.env.METRICAS_JSON_DIR
  ? path.resolve(process.env.METRICAS_JSON_DIR)
  : path.join(process.cwd(), "public", "data", "metricas-etl")
const SNAPSHOT_BASE_URL = process.env.METRICAS_JSON_BASE_URL?.trim()
const MANIFEST_FILE = "metricas-manifest.json"

let snapshotCache: { loadedAt: number; data: FlujoSnapshot } | null = null
let snapshotPromise: Promise<FlujoSnapshot> | null = null

function validateFileName(fileName: string) {
  if (path.basename(fileName) !== fileName || !fileName.endsWith(".json.gz")) {
    throw new Error(`Nombre de snapshot de flujo invalido: ${fileName}`)
  }
}

async function deserializeSnapshot(input: Buffer, entry: ManifestEntry) {
  if (input.length !== entry.bytes) {
    throw new Error("El tamano del snapshot de flujo no coincide con el manifest")
  }

  const digest = createHash("sha256").update(input).digest("hex")
  if (digest !== entry.sha256) {
    throw new Error("El checksum del snapshot de flujo no coincide con el manifest")
  }

  const raw = (await gunzip(input)).toString("utf8")
  const snapshot = JSON.parse(raw) as FlujoSnapshot
  if (snapshot.schemaVersion !== 1) {
    throw new Error(`Version de flujo no soportada: ${snapshot.schemaVersion}`)
  }
  return snapshot
}

function remoteUrl(fileName: string) {
  if (!SNAPSHOT_BASE_URL) return null
  return new URL(
    fileName,
    SNAPSHOT_BASE_URL.endsWith("/")
      ? SNAPSHOT_BASE_URL
      : `${SNAPSHOT_BASE_URL}/`
  ).toString()
}

async function readRemoteSnapshot() {
  const manifestUrl = remoteUrl(MANIFEST_FILE)
  if (!manifestUrl) return null

  const manifestResponse = await fetch(manifestUrl, { cache: "no-store" })
  if (!manifestResponse.ok) {
    throw new Error(`No se pudo descargar el manifest de flujo: ${manifestResponse.status}`)
  }
  const manifest = (await manifestResponse.json()) as EtlManifest
  const entry = manifest.flujoMantenimiento
  if (!entry) throw new Error("El manifest no contiene flujoMantenimiento")
  validateFileName(entry.file)

  const snapshotUrl = remoteUrl(entry.file)
  if (!snapshotUrl) return null
  const response = await fetch(snapshotUrl, { cache: "no-store" })
  if (!response.ok) {
    throw new Error(`No se pudo descargar el snapshot de flujo: ${response.status}`)
  }
  return deserializeSnapshot(Buffer.from(await response.arrayBuffer()), entry)
}

async function readLocalSnapshot() {
  const manifest = JSON.parse(
    await fs.readFile(path.join(SNAPSHOT_DIR, MANIFEST_FILE), "utf8")
  ) as EtlManifest
  const entry = manifest.flujoMantenimiento
  if (!entry) throw new Error("El manifest no contiene flujoMantenimiento")
  validateFileName(entry.file)
  const input = await fs.readFile(path.join(SNAPSHOT_DIR, entry.file))
  return deserializeSnapshot(input, entry)
}

async function loadSnapshot() {
  if (snapshotCache && Date.now() - snapshotCache.loadedAt < CACHE_TTL_MS) {
    return snapshotCache.data
  }

  if (!snapshotPromise) {
    snapshotPromise = (async () => {
      const remote = await readRemoteSnapshot()
      const data = remote ?? (await readLocalSnapshot())
      snapshotCache = { loadedAt: Date.now(), data }
      return data
    })().finally(() => {
      snapshotPromise = null
    })
  }

  return snapshotPromise
}

function incrementRecord(
  target: Record<string, number>,
  source: Record<string, number>
) {
  for (const [key, value] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + value
  }
}

function topEntries(record: Record<string, number>, limit = 8) {
  return Object.entries(record)
    .map(([name, cantidad]) => ({ name, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad || a.name.localeCompare(b.name))
    .slice(0, limit)
}

function percentage(value: number, total: number) {
  return total ? Number(((value / total) * 100).toFixed(1)) : 0
}

function validAreas(values: string[] | undefined) {
  const requested = new Set(values ?? [])
  const selected = MANTENIMIENTO_DATASET_KEYS.filter((key) => requested.has(key))
  return selected.length ? selected : MANTENIMIENTO_DATASET_KEYS
}

export async function getFlujoMantenimientoData(
  filters: FlujoFilters = {}
): Promise<FlujoMantenimientoPayload> {
  const snapshot = await loadSnapshot()
  const allMonths = snapshot.areas.alumbrado.map((row) => row.mes)
  const allYears = Array.from(new Set(allMonths.map((month) => month.slice(0, 4))))
  const selectedAreas = validAreas(filters.areas)
  const requestedMonths = new Set(filters.months ?? [])
  const requestedYears = new Set(filters.years ?? [])
  const selectedMonths = allMonths.filter((month) => {
    if (requestedMonths.size) return requestedMonths.has(month)
    if (requestedYears.size) return requestedYears.has(month.slice(0, 4))
    return true
  })
  const selectedMonthSet = new Set(selectedMonths)
  const stockMonth = selectedMonths.at(-1) ?? null
  const byAreaMonth = new Map(
    MANTENIMIENTO_DATASET_KEYS.map((area) => [
      area,
      new Map(snapshot.areas[area].map((row) => [row.mes, row])),
    ])
  )

  let ingresos = 0
  let bajas = 0
  let resueltos = 0
  let denegados = 0
  const motivosBaja: Record<string, number> = {}
  const ingresosPorPrestacion: Record<string, number> = {}

  for (const area of selectedAreas) {
    for (const row of snapshot.areas[area]) {
      if (!selectedMonthSet.has(row.mes)) continue
      ingresos += row.ingresos
      bajas += row.bajas
      resueltos += row.resueltos
      denegados += row.denegados
      incrementRecord(motivosBaja, row.motivosBaja)
      incrementRecord(ingresosPorPrestacion, row.ingresosPorPrestacion)
    }
  }

  const porMes = selectedMonths.map((mes) => {
    const result = { mes, ingresos: 0, bajas: 0, pendientes: 0 }
    for (const area of selectedAreas) {
      const row = byAreaMonth.get(area)?.get(mes)
      if (!row) continue
      result.ingresos += row.ingresos
      result.bajas += row.bajas
      result.pendientes += row.pendientes
    }
    return result
  })

  const pendientesPorArea = selectedAreas.map((area) => ({
    area: FLUJO_AREA_LABELS[area],
    cantidad: stockMonth ? byAreaMonth.get(area)?.get(stockMonth)?.pendientes ?? 0 : 0,
  }))
  const pendientes = pendientesPorArea.reduce((sum, row) => sum + row.cantidad, 0)
  const pendientesPorPrestacion: Record<string, number> = {}

  if (stockMonth) {
    for (const area of selectedAreas) {
      incrementRecord(
        pendientesPorPrestacion,
        byAreaMonth.get(area)?.get(stockMonth)?.pendientesPorPrestacion ?? {}
      )
    }
  }

  const totalBajasClasificadas = resueltos + denegados
  const totalMotivos = Object.values(motivosBaja).reduce((sum, value) => sum + value, 0)

  return {
    resumen: {
      ingresos,
      bajas,
      pendientes,
      resueltos,
      denegados,
      generado: snapshot.generatedAt,
      stockMes: stockMonth,
    },
    por_mes: porMes,
    flujo_bajas: [
      {
        nombre: "Resueltos",
        cantidad: resueltos,
        porcentaje: percentage(resueltos, totalBajasClasificadas),
      },
      {
        nombre: "Denegados",
        cantidad: denegados,
        porcentaje: percentage(denegados, totalBajasClasificadas),
      },
    ],
    motivos_baja: topEntries(motivosBaja, 20).map(({ name, cantidad }) => ({
      motivo: name,
      cantidad,
      porcentaje: percentage(cantidad, totalMotivos),
    })),
    pendientes_por_area: pendientesPorArea
      .map((row) => ({
        ...row,
        porcentaje: percentage(row.cantidad, pendientes),
      }))
      .sort((a, b) => b.cantidad - a.cantidad),
    top_ingresos_prestacion: topEntries(ingresosPorPrestacion).map(
      ({ name, cantidad }) => ({ prestacion: name, cantidad })
    ),
    top_pendientes_prestacion: topEntries(pendientesPorPrestacion).map(
      ({ name, cantidad }) => ({ prestacion: name, cantidad })
    ),
    filtros: {
      years: allYears,
      months: allMonths,
      areas: MANTENIMIENTO_DATASET_KEYS.map((value) => ({
        value,
        label: FLUJO_AREA_LABELS[value],
      })),
      selectedYears: filters.years ?? [],
      selectedMonths: filters.months ?? [],
      selectedAreas,
    },
  }
}

export function warmFlujoMantenimientoCache() {
  void loadSnapshot().catch((error) => {
    console.warn("No se pudo precargar el flujo de mantenimiento", error)
  })
}
