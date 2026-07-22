import { createHash } from "crypto"
import { promises as fs } from "fs"
import path from "path"
import { promisify } from "util"
import { gunzip as gunzipCallback } from "zlib"

import {
  MANTENIMIENTO_DATASET_KEYS,
  type MantenimientoDatasetKey,
} from "./metricas-csv"
import { FLUJO_MOTIVOS_BAJA } from "./flujo-mantenimiento-csv"

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
  ingresosPorComuna: Record<string, number>
  ingresosPorBarrio: Record<string, number>
  ingresosPorHora: Record<string, number>
  prestacionesPorHora: Record<string, Record<string, number>>
}

type FlujoSnapshot = {
  schemaVersion: 2
  generatedAt: string
  records: number
  areas: Record<MantenimientoDatasetKey, FlujoMonthSnapshot[]>
  rows: FlujoSnapshotRow[]
}

type FlujoSnapshotRow = {
  area: MantenimientoDatasetKey
  ingresoMes: number
  bajaMes: number | null
  horaIngreso: string | null
  comuna: string | null
  barrio: string | null
  categoria: string
  prestacion: string
  statusUsuario: string
  estado: "resueltos" | "pendientes" | "denegados"
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
  prestacion?: string[]
  categoria?: string[]
  comuna?: string[]
  barrio?: string[]
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
  por_comuna: Record<
    string,
    { total: number; resueltos: number; pendientes: number; denegados: number }
  >
  por_barrio: Array<{
    barrio: string
    cantidad: number
    porcentaje: number
  }>
  barrio_totales: Record<string, number>
  por_hora: Array<{
    hora: string
    cantidad: number
    porcentaje: number
    top_prestaciones: Array<{
      prestacion: string
      cantidad: number
      porcentaje: number
    }>
  }>
  filtros: {
    years: string[]
    months: string[]
    areas: Array<{ value: MantenimientoDatasetKey; label: string }>
    prestaciones: string[]
    categorias: string[]
    comunas: string[]
    barrios: string[]
    selectedYears: string[]
    selectedMonths: string[]
    selectedAreas: MantenimientoDatasetKey[]
    selectedPrestaciones: string[]
    selectedCategorias: string[]
    selectedComunas: string[]
    selectedBarrios: string[]
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
  if (snapshot.schemaVersion !== 2) {
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

function incrementValue(target: Record<string, number>, key: string) {
  target[key] = (target[key] ?? 0) + 1
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

function monthIndex(value: string) {
  const [year, month] = value.split("-").map(Number)
  return year * 12 + month - 1
}

function formatMonth(index: number) {
  const year = Math.floor(index / 12)
  const month = (index % 12) + 1
  return `${year}-${String(month).padStart(2, "0")}`
}

export async function getFlujoMantenimientoData(
  filters: FlujoFilters = {}
): Promise<FlujoMantenimientoPayload> {
  const snapshot = await loadSnapshot()
  const allMonths = snapshot.areas.alumbrado.map((row) => row.mes)
  const allYears = Array.from(new Set(allMonths.map((month) => month.slice(0, 4))))
  const selectedAreas = validAreas(filters.areas)
  const selectedAreaSet = new Set(selectedAreas)
  const requestedMonths = new Set(filters.months ?? [])
  const requestedYears = new Set(filters.years ?? [])
  const selectedMonths = allMonths.filter((month) => {
    if (requestedMonths.size) return requestedMonths.has(month)
    if (requestedYears.size) return requestedYears.has(month.slice(0, 4))
    return true
  })
  const selectedMonthSet = new Set(selectedMonths)
  const stockMonth = selectedMonths.at(-1) ?? null
  const stockMonthIndex = stockMonth ? monthIndex(stockMonth) : null
  const selectedPrestaciones = new Set(filters.prestacion ?? [])
  const selectedCategorias = new Set(filters.categoria ?? [])
  const selectedComunas = new Set(filters.comuna ?? [])
  const selectedBarrios = new Set(filters.barrio ?? [])

  let ingresos = 0
  let bajas = 0
  let resueltos = 0
  let denegados = 0
  const monthlyIngresos = new Map<number, number>()
  const monthlyBajas = new Map<number, number>()
  const pendingDeltas = new Map<number, number>()
  const motivosBaja: Record<string, number> = {}
  const ingresosPorPrestacion: Record<string, number> = {}
  const pendientesPorPrestacion: Record<string, number> = {}
  const ingresosPorComuna: Record<string, number> = {}
  const ingresosPorBarrio: Record<string, number> = {}
  const ingresosPorHora: Record<string, number> = {}
  const prestacionesPorHora: Record<string, Record<string, number>> = {}
  const pendientesPorArea: Partial<Record<MantenimientoDatasetKey, number>> = {}
  const prestaciones = new Set<string>()
  const categorias = new Set<string>()
  const comunas = new Set<string>()
  const barrios = new Set<string>()

  for (const row of snapshot.rows) {
    if (!selectedAreaSet.has(row.area)) continue

    prestaciones.add(row.prestacion)
    categorias.add(row.categoria)
    if (row.comuna) comunas.add(row.comuna)
    if (row.barrio) barrios.add(row.barrio)

    if (selectedPrestaciones.size && !selectedPrestaciones.has(row.prestacion)) continue
    if (selectedCategorias.size && !selectedCategorias.has(row.categoria)) continue
    if (selectedComunas.size && !selectedComunas.has(row.comuna ?? "")) continue
    if (selectedBarrios.size && !selectedBarrios.has(row.barrio ?? "")) continue

    const contributesToStock = row.estado === "pendientes" || row.bajaMes !== null
    if (contributesToStock) {
      pendingDeltas.set(
        row.ingresoMes,
        (pendingDeltas.get(row.ingresoMes) ?? 0) + 1
      )
      if (row.bajaMes !== null) {
        pendingDeltas.set(row.bajaMes, (pendingDeltas.get(row.bajaMes) ?? 0) - 1)
      }
    }

    if (selectedMonthSet.has(formatMonth(row.ingresoMes))) {
      ingresos += 1
      monthlyIngresos.set(
        row.ingresoMes,
        (monthlyIngresos.get(row.ingresoMes) ?? 0) + 1
      )
      incrementValue(ingresosPorPrestacion, row.prestacion)
      if (row.comuna) incrementValue(ingresosPorComuna, row.comuna)
      if (row.barrio) incrementValue(ingresosPorBarrio, row.barrio)
      if (row.horaIngreso) {
        incrementValue(ingresosPorHora, row.horaIngreso)
        prestacionesPorHora[row.horaIngreso] ??= {}
        incrementValue(prestacionesPorHora[row.horaIngreso], row.prestacion)
      }
    }

    if (row.bajaMes !== null && selectedMonthSet.has(formatMonth(row.bajaMes))) {
      bajas += 1
      monthlyBajas.set(row.bajaMes, (monthlyBajas.get(row.bajaMes) ?? 0) + 1)
      if (row.estado === "resueltos") resueltos += 1
      if (row.estado === "denegados") denegados += 1
      const motivo = FLUJO_MOTIVOS_BAJA[row.statusUsuario] ?? row.statusUsuario
      incrementValue(motivosBaja, motivo)
    }

    const isPendingAtClose =
      stockMonthIndex !== null &&
      row.ingresoMes <= stockMonthIndex &&
      (row.estado === "pendientes" ||
        (row.bajaMes !== null && row.bajaMes > stockMonthIndex))

    if (isPendingAtClose) {
      pendientesPorArea[row.area] = (pendientesPorArea[row.area] ?? 0) + 1
      incrementValue(pendientesPorPrestacion, row.prestacion)
    }
  }

  let runningStock = 0
  const stockByMonth = new Map<number, number>()
  for (const month of allMonths) {
    const index = monthIndex(month)
    runningStock += pendingDeltas.get(index) ?? 0
    stockByMonth.set(index, Math.max(0, runningStock))
  }

  const porMes = selectedMonths.map((mes) => {
    const index = monthIndex(mes)
    return {
      mes,
      ingresos: monthlyIngresos.get(index) ?? 0,
      bajas: monthlyBajas.get(index) ?? 0,
      pendientes: stockByMonth.get(index) ?? 0,
    }
  })

  const pendientesPorAreaRows = selectedAreas.map((area) => ({
    area: FLUJO_AREA_LABELS[area],
    cantidad: pendientesPorArea[area] ?? 0,
  }))
  const pendientes = pendientesPorAreaRows.reduce((sum, row) => sum + row.cantidad, 0)

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
    pendientes_por_area: pendientesPorAreaRows
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
    por_comuna: Object.fromEntries(
      Object.entries(ingresosPorComuna).map(([comuna, total]) => [
        comuna,
        { total, resueltos: 0, pendientes: 0, denegados: 0 },
      ])
    ),
    por_barrio: topEntries(ingresosPorBarrio).map(({ name, cantidad }) => ({
      barrio: name,
      cantidad,
      porcentaje: percentage(cantidad, ingresos),
    })),
    barrio_totales: ingresosPorBarrio,
    por_hora: Object.entries(ingresosPorHora)
      .map(([hora, cantidad]) => ({
        hora,
        cantidad,
        porcentaje: percentage(cantidad, ingresos),
        top_prestaciones: topEntries(prestacionesPorHora[hora] ?? {}, 2).map(
          ({ name, cantidad: prestacionCantidad }) => ({
            prestacion: name,
            cantidad: prestacionCantidad,
            porcentaje: percentage(prestacionCantidad, cantidad),
          })
        ),
      }))
      .sort((a, b) => a.hora.localeCompare(b.hora)),
    filtros: {
      years: allYears,
      months: allMonths,
      areas: MANTENIMIENTO_DATASET_KEYS.map((value) => ({
        value,
        label: FLUJO_AREA_LABELS[value],
      })),
      prestaciones: Array.from(prestaciones).sort((a, b) => a.localeCompare(b)),
      categorias: Array.from(categorias).sort((a, b) => a.localeCompare(b)),
      comunas: Array.from(comunas).sort((a, b) => a.localeCompare(b)),
      barrios: Array.from(barrios).sort((a, b) => a.localeCompare(b)),
      selectedYears: filters.years ?? [],
      selectedMonths: filters.months ?? [],
      selectedAreas,
      selectedPrestaciones: filters.prestacion ?? [],
      selectedCategorias: filters.categoria ?? [],
      selectedComunas: filters.comuna ?? [],
      selectedBarrios: filters.barrio ?? [],
    },
  }
}

export function warmFlujoMantenimientoCache() {
  void loadSnapshot().catch((error) => {
    console.warn("No se pudo precargar el flujo de mantenimiento", error)
  })
}
