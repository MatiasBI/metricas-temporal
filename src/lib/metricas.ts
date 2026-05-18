import { promises as fs } from "fs"
import { createReadStream } from "fs"
import path from "path"
import { Readable } from "stream"
import { parse } from "csv-parse"

import { BARRIOS_BY_COMUNA } from "./barrios"

type EstadoClave = "resueltos" | "pendientes" | "denegados"

type NormalizedRow = {
  aviso?: string | null
  fecha: Date | null
  horaIngreso: string | null
  comuna: string | null
  barrio: string | null
  categoria: string | null
  prestacion: string | null
  grupoPlanificacion?: string | null
  statusUsuario?: string | null
  motivoDenegado: string | null
  estado: EstadoClave | null
  ultMes: string
}

type DatasetSnapshot = {
  rows: NormalizedRow[]
  filtros: {
    years: string[]
    prestaciones: string[]
    categorias: string[]
    comunas: string[]
    barrios: string[]
  }
}

type PersistedDatasetSnapshot = {
  rows: Array<Omit<NormalizedRow, "fecha"> & { fecha: string | null }>
  filtros: DatasetSnapshot["filtros"]
}

type CsvRow = string[]

type FiltrosMetricas = {
  years?: string[]
  months?: string[]
  prestacion?: string[]
  categoria?: string[]
  comuna?: string[]
  barrio?: string[]
}

export type MetricasExportRow = {
  aviso: string
  fecha_ingreso: string
  hora_ingreso: string
  comuna: string
  barrio: string
  categoria: string
  prestacion: string
  grupo_planificacion: string
  status_usuario: string
  estado: string
  motivo_denegado: string
  ult_mes: string
}

export type MetricasPayload = {
  resumen: {
    total: number
    resueltos: number
    pendientes: number
    denegados: number
    pct_resueltos: number
    pct_pendientes: number
    pct_denegados: number
    generado: string
  }
  por_comuna: Record<
    string,
    { total: number; resueltos: number; pendientes: number; denegados: number }
  >
  por_categoria: Array<{
    nombre: string
    pendiente: number
    denegado: number
    resuelto: number
    total: number
  }>
  por_mes: Array<{
    mes: string
    total: number
    resueltos: number
    pendientes: number
    denegados: number
  }>
  motivos_baja: Array<{ motivo: string; cantidad: number; porcentaje: number }>
  top_ingresos_prestacion: Array<{
    prestacion: string
    cantidad: number
    porcentaje: number
  }>
  top_pendientes_prestacion: Array<{
    prestacion: string
    cantidad: number
    porcentaje: number
  }>
  por_barrio: Array<{
    barrio: string
    cantidad: number
    porcentaje: number
  }>
  por_hora: Array<{
    hora: string
    cantidad: number
    porcentaje: number
  }>
  barrio_totales: Record<string, number>
  flujo_bajas: {
    resueltos: number
    pendientes: number
    denegados: number
    pct_resueltos: number
    pct_pendientes: number
    pct_denegados: number
  }
  filtros: {
    years: string[]
    prestaciones: string[]
    categorias: string[]
    comunas: string[]
    barrios: string[]
  }
}

export type MetricasDatasetKey =
  | "alumbrado"
  | "paisaje-urbano"

const CACHE_TTL_MS = 15 * 60 * 1000
const DEMO_SNAPSHOT_DIR = path.join(process.cwd(), "src", "data", "metricas-demo")
const DEFAULT_CSV_PATH =
  "C:\\Users\\Usuario\\Downloads\\avisos crudo 08-05.csv"
const CSV_PATH = process.env.METRICAS_CSV_PATH || DEFAULT_CSV_PATH
const CSV_URL = process.env.METRICAS_CSV_URL
const JSON_SNAPSHOT_DIR = process.env.METRICAS_JSON_DIR
const JSON_SNAPSHOT_BASE_URL = process.env.METRICAS_JSON_BASE_URL
const DEFAULT_CSV_DELIMITER = "|"
const DEFAULT_CSV_FROM_LINE = 1
const CACHE_FILE_NAMES: Record<MetricasDatasetKey, string> = {
  alumbrado: "metricas-alumbrado-dataset.json",
  "paisaje-urbano": "metricas-paisaje-urbano-dataset.json",
}

const DEMO_FILE_NAMES: Record<MetricasDatasetKey, string> = {
  alumbrado: "alumbrado-dataset.json",
  "paisaje-urbano": "paisaje-urbano-dataset.json",
}

const MESES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
]

const VALID_COMUNAS = new Set(
  Array.from({ length: 15 }, (_, index) => `C${String(index + 1).padStart(2, "0")}`)
)

const ALUMBRADO_PRESTACIONES = new Set([
  "COLUMNA DE ALUMBRADO: TAPA FALT Y/O DETE",
  "LUMINARIA: APAGADA",
  "LUMINARIA: ARTEFACTO ROTO Y/O FALTANTE",
  "LUMINARIA: ENCENDIDO INTERMITENTE",
  "LUMINARIA: ENCENDIDO PERMANENTE",
  "LUMINARIA: LIMPIEZA DE ARTEFACTO",
  "TOMA DE ENERGIA: FALTANTE O DETERIORADA",
  "LUMINARIA: REFUERZO DE ALUMBRADO PUBLICO",
])

const ALUMBRADO_GRUPOS_EXCLUIDOS = new Set(["ALU", "ALD"])
const PAISAJE_PRESTACIONES = new Set([
  "BANCOS EN PARQUES Y PLAZAS: COLOCACION",
  "SOLICITUD DE INSTALACIÓN DE CANILES",
  "SOLICITUD DE INST. DE BAÑOS PÚBLICOS",
  "CESTOS EN PLAZAS Y PARQUES: SOLICITUD",
  "SOLICITUD DE PATIO DE JUEGOS",
  "SOLICITUD DE ÁREAS DEPORTIVAS",
  "FUENTES EN PLAZAS Y PARQUES: SOLICITUD D",
  "SOLICITUD DE INSTALACIÓN DE BEBEDEROS",
  "BANCOS EN PARQUES Y PLAZAS: REPARACION",
  "BANCOS Y MESAS DE PARQUES Y PLAZAS: REPA",
  "PATIO DE JUEGOS EN PLAZAS Y PARQUES: REP",
  "INSTALACION DE REJAS EN PARQUE / PLAZA",
  "REJAS EN PARQUES Y PLAZAS: SOLICITUD",
  "MANTENIMIENTO DE BAÑOS PÚBLICOS",
  "MANTENIMIENTO EN SENDEROS / SOLADOS",
  "REPARACION DE CESTOS EN PLAZAS Y PARQUES",
  "MONUMENTO Y OBRA DE ARTE EN PLAZAS Y PAR",
  "FUENTES EN PLAZAS Y PARQUES: DETERIORO",
  "MANTENIMIENTO DE RIEGO - CÉSPED",
  "CESPED EN PLAZAS Y PARQUES: CORTE Y LIMP",
  "RIEGO EN PLAZAS Y PARQUES: MANTENIMIENTO",
  "MANTENIMIENTO DE CANILES",
  "CANILES EN PLAZAS Y PARQUES: LIMPIEZA Y/",
  "MANTENIMIENTO EN BEBEDEROS",
  "MANTENIMIENTO DE ÁREAS DEPORTIVAS",
])

const STATUS_MAP: Record<string, EstadoClave> = {
  REOK: "resueltos",
  TERC: "resueltos",
  OPER: "pendientes",
  INIC: "pendientes",
  PLAN: "pendientes",
  VERI: "pendientes",
  PROG: "pendientes",
  SERV: "pendientes",
  IM01: "denegados",
  IM02: "denegados",
  IM03: "denegados",
  IM04: "denegados",
  IM05: "denegados",
  CANC: "denegados",
}

const DENEGADO_MOTIVOS: Record<string, string> = {
  CANC: "Cancelado",
  IM01: "Falla Inexistente",
  IM02: "Falta Informacion",
  IM03: "Imposibilidad Tecnica",
  IM04: "Fuera de Competencia",
  IM05: "Cancelado por Usuario",
}

const COLUMN = {
  comuna: 0,
  aviso: 2,
  barrio: 6,
  fechaAviso: 9,
  prestacion: 16,
  grupoPlanificacion: 22,
  horaIngreso: 25,
  statusUsuario: 37,
  tipo: 39,
} as const

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function normalizeComuna(value: string) {
  const comuna = normalizeText(value).toUpperCase()
  return VALID_COMUNAS.has(comuna) ? comuna : null
}

function parseCsvDate(value: string) {
  const raw = normalizeText(value)

  if (!/^\d{8}$/.test(raw)) {
    return null
  }

  const year = Number(raw.slice(0, 4))
  const month = Number(raw.slice(4, 6))
  const day = Number(raw.slice(6, 8))
  const parsed = new Date(Date.UTC(year, month - 1, day))

  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function parseCsvTime(value: string) {
  const raw = normalizeText(value).padStart(6, "0")

  if (!/^\d{6}$/.test(raw)) {
    return null
  }

  const hours = Number(raw.slice(0, 2))
  const minutes = Number(raw.slice(2, 4))
  const seconds = Number(raw.slice(4, 6))

  if (hours > 23 || minutes > 59 || seconds > 59) {
    return null
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

function normalizeEstado(value: string) {
  return STATUS_MAP[normalizeText(value).toUpperCase()] ?? null
}

function normalizeMotivoDenegado(value: string) {
  return DENEGADO_MOTIVOS[normalizeText(value).toUpperCase()] ?? null
}

function get(row: CsvRow, index: number) {
  return row[index] ?? ""
}

function isCoreCsvRow(row: CsvRow) {
  return Boolean(
    normalizeComuna(get(row, COLUMN.comuna)) &&
      normalizeText(get(row, COLUMN.aviso)) &&
      parseCsvDate(get(row, COLUMN.fechaAviso)) &&
      normalizeText(get(row, COLUMN.prestacion)) &&
      normalizeEstado(get(row, COLUMN.statusUsuario))
  )
}

function getCsvDatasetKey(row: CsvRow): MetricasDatasetKey | null {
  const prestacion = normalizeText(get(row, COLUMN.prestacion))
  const grupo = normalizeText(get(row, COLUMN.grupoPlanificacion)).toUpperCase()

  if (
    grupo.startsWith("AL") &&
    !ALUMBRADO_GRUPOS_EXCLUIDOS.has(grupo) &&
    ALUMBRADO_PRESTACIONES.has(prestacion)
  ) {
    return "alumbrado"
  }

  if (PAISAJE_PRESTACIONES.has(prestacion)) {
    return "paisaje-urbano"
  }

  return null
}

function normalizeCsvRow(row: CsvRow, datasetKey: MetricasDatasetKey): NormalizedRow {
  const fecha = parseCsvDate(get(row, COLUMN.fechaAviso))
  const aviso = normalizeText(get(row, COLUMN.aviso))
  const prestacion = normalizeText(get(row, COLUMN.prestacion))
  const grupoPlanificacion = normalizeText(get(row, COLUMN.grupoPlanificacion)).toUpperCase()
  const statusUsuario = normalizeText(get(row, COLUMN.statusUsuario)).toUpperCase() || null
  const estado = normalizeEstado(get(row, COLUMN.statusUsuario))

  return {
    aviso: aviso || null,
    fecha,
    horaIngreso: parseCsvTime(get(row, COLUMN.horaIngreso)),
    comuna: normalizeComuna(get(row, COLUMN.comuna)),
    barrio: normalizeText(get(row, COLUMN.barrio)) || null,
    categoria:
      datasetKey === "alumbrado"
        ? prestacion || null
        : normalizeText(get(row, COLUMN.tipo)) || null,
    prestacion: prestacion || null,
    grupoPlanificacion: grupoPlanificacion || null,
    statusUsuario,
    motivoDenegado: estado === "denegados" ? normalizeMotivoDenegado(get(row, COLUMN.statusUsuario)) : null,
    estado,
    ultMes: "",
  }
}

function formatearUltimaActualizacion(fecha: Date | null, ultMes?: string) {
  if (ultMes?.trim()) return ultMes.trim()
  if (!fecha) return "Sin datos"
  return `${MESES_ES[fecha.getUTCMonth()]} ${fecha.getUTCFullYear()}`
}

function getDatasetCachePath(datasetKey: MetricasDatasetKey) {
  return path.join(
    process.cwd(),
    ".next",
    "cache",
    CACHE_FILE_NAMES[datasetKey]
  )
}

function getJsonSnapshotPath(datasetKey: MetricasDatasetKey) {
  return JSON_SNAPSHOT_DIR
    ? path.join(JSON_SNAPSHOT_DIR, CACHE_FILE_NAMES[datasetKey])
    : null
}

function getJsonSnapshotBaseUrl(datasetKey: MetricasDatasetKey) {
  if (!JSON_SNAPSHOT_BASE_URL) {
    return null
  }

  const fileName = CACHE_FILE_NAMES[datasetKey]
  const baseUrl = JSON_SNAPSHOT_BASE_URL.trim()

  if (isGoogleDriveFolderUrl(baseUrl)) {
    return resolveGoogleDriveFolderFileUrl(baseUrl, fileName)
  }

  return new URL(
    fileName,
    baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`
  ).toString()
}

function hashString(value: string) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash
}

function resolveSyntheticBarrio(row: {
  comuna: string | null
  fecha: Date | null
  categoria: string | null
  prestacion: string | null
  motivoDenegado: string | null
}) {
  if (!row.comuna) {
    return null
  }

  const barrios = BARRIOS_BY_COMUNA[row.comuna]

  if (!barrios?.length) {
    return null
  }

  const fingerprint = [
    row.comuna,
    row.fecha?.toISOString() ?? "",
    row.categoria ?? "",
    row.prestacion ?? "",
    row.motivoDenegado ?? "",
  ].join("|")

  return barrios[hashString(fingerprint) % barrios.length]
}

function resolveSyntheticHoraIngreso(row: {
  fecha: Date | null
  comuna: string | null
  categoria: string | null
  prestacion: string | null
  motivoDenegado: string | null
}) {
  const fingerprint = [
    row.fecha?.toISOString() ?? "",
    row.comuna ?? "",
    row.categoria ?? "",
    row.prestacion ?? "",
    row.motivoDenegado ?? "",
  ].join("|")

  const hash = hashString(fingerprint)
  const weightedHourBuckets = [
    { hour: 7, weight: 2 },
    { hour: 8, weight: 5 },
    { hour: 9, weight: 11 },
    { hour: 10, weight: 15 },
    { hour: 11, weight: 13 },
    { hour: 12, weight: 9 },
    { hour: 13, weight: 6 },
    { hour: 14, weight: 8 },
    { hour: 15, weight: 10 },
    { hour: 16, weight: 9 },
    { hour: 17, weight: 6 },
    { hour: 18, weight: 3 },
    { hour: 19, weight: 2 },
    { hour: 20, weight: 1 },
    { hour: 21, weight: 1 },
  ]
  const totalWeight = weightedHourBuckets.reduce(
    (sum, bucket) => sum + bucket.weight,
    0
  )
  const target = hash % totalWeight
  let cumulative = 0
  let selectedHour = 10

  for (const bucket of weightedHourBuckets) {
    cumulative += bucket.weight
    if (target < cumulative) {
      selectedHour = bucket.hour
      break
    }
  }

  const minutes = String((hash >>> 3) % 60).padStart(2, "0")
  const hours = String(selectedHour).padStart(2, "0")

  return `${hours}:${minutes}`
}

function getDemoSnapshotPath(datasetKey: MetricasDatasetKey) {
  return path.join(DEMO_SNAPSHOT_DIR, DEMO_FILE_NAMES[datasetKey])
}

function serializeSnapshot(snapshot: DatasetSnapshot): PersistedDatasetSnapshot {
  return {
    ...snapshot,
    rows: snapshot.rows.map((row) => ({
      ...row,
      fecha: row.fecha ? row.fecha.toISOString() : null,
    })),
  }
}

function deserializeSnapshot(
  snapshot: PersistedDatasetSnapshot
): DatasetSnapshot {
  const rows = snapshot.rows.map((row) => ({
    ...row,
    fecha: row.fecha ? new Date(row.fecha) : null,
    horaIngreso:
      row.horaIngreso ??
      resolveSyntheticHoraIngreso({
        fecha: row.fecha ? new Date(row.fecha) : null,
        comuna: row.comuna,
        categoria: row.categoria,
        prestacion: row.prestacion,
        motivoDenegado: row.motivoDenegado,
      }),
    barrio: row.barrio ?? resolveSyntheticBarrio({
      comuna: row.comuna,
      fecha: row.fecha ? new Date(row.fecha) : null,
      categoria: row.categoria,
      prestacion: row.prestacion,
      motivoDenegado: row.motivoDenegado,
    }),
  }))

  return {
    ...snapshot,
    rows,
    filtros: {
      ...snapshot.filtros,
      barrios:
        snapshot.filtros.barrios ??
        (Array.from(new Set(rows.map((row) => row.barrio).filter(Boolean))).sort() as string[]),
    },
  }
}

async function persistSnapshot(
  datasetKey: MetricasDatasetKey,
  snapshot: DatasetSnapshot
) {
  const datasetCachePath = getDatasetCachePath(datasetKey)
  await fs.mkdir(path.dirname(datasetCachePath), { recursive: true })
  await fs.writeFile(
    datasetCachePath,
    JSON.stringify(serializeSnapshot(snapshot)),
    "utf8"
  )
}

async function persistSnapshotSafely(
  datasetKey: MetricasDatasetKey,
  snapshot: DatasetSnapshot
) {
  try {
    await persistSnapshot(datasetKey, snapshot)
  } catch (error) {
    console.warn("No se pudo persistir el snapshot de metricas", {
      datasetKey,
      error,
    })
  }
}

async function readPersistedSnapshot(datasetKey: MetricasDatasetKey) {
  const datasetCachePath = getDatasetCachePath(datasetKey)
  try {
    const raw = await fs.readFile(datasetCachePath, "utf8")
    return deserializeSnapshot(JSON.parse(raw) as PersistedDatasetSnapshot)
  } catch {
    return null
  }
}

async function readJsonSnapshot(datasetKey: MetricasDatasetKey) {
  const snapshotPath = getJsonSnapshotPath(datasetKey)
  if (snapshotPath) {
    try {
      const raw = await fs.readFile(snapshotPath, "utf8")
      return deserializeSnapshot(JSON.parse(raw) as PersistedDatasetSnapshot)
    } catch {
      return null
    }
  }

  const snapshotUrl = await getJsonSnapshotBaseUrl(datasetKey)
  if (!snapshotUrl) {
    return null
  }

  try {
    const response = await fetchCsvDownloadResponse(snapshotUrl)

    if (!response.ok) {
      throw new Error(`No se pudo descargar el JSON ${datasetKey}: ${response.status}`)
    }

    const raw = await response.text()
    return deserializeSnapshot(JSON.parse(raw) as PersistedDatasetSnapshot)
  } catch (error) {
    console.warn("No se pudo leer el snapshot JSON remoto", {
      datasetKey,
      error,
    })
    return null
  }
}

async function readFreshPersistedSnapshot(datasetKey: MetricasDatasetKey) {
  if (CSV_URL) {
    return null
  }

  const datasetCachePath = getDatasetCachePath(datasetKey)

  try {
    const [csvStat, snapshotStat] = await Promise.all([
      fs.stat(CSV_PATH),
      fs.stat(datasetCachePath),
    ])

    if (snapshotStat.mtimeMs < csvStat.mtimeMs) {
      return null
    }
  } catch {
    return null
  }

  return readPersistedSnapshot(datasetKey)
}

async function readDemoSnapshot(datasetKey: MetricasDatasetKey) {
  const demoSnapshotPath = getDemoSnapshotPath(datasetKey)
  try {
    const raw = await fs.readFile(demoSnapshotPath, "utf8")
    return deserializeSnapshot(JSON.parse(raw) as PersistedDatasetSnapshot)
  } catch {
    return null
  }
}

function buildDatasetSnapshot(rows: NormalizedRow[]): DatasetSnapshot {
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
    rows,
    filtros: {
      years: Array.from(years).sort(),
      prestaciones: Array.from(prestaciones).sort(),
      categorias: Array.from(categorias).sort(),
      comunas: Array.from(comunas).sort(),
      barrios: Array.from(barrios).sort(),
    },
  }
}

async function createCsvInputStream() {
  if (!CSV_URL) {
    return createReadStream(CSV_PATH)
  }

  const response = await fetchCsvDownloadResponse(CSV_URL)

  if (!response.ok || !response.body) {
    throw new Error(`No se pudo descargar el CSV crudo: ${response.status}`)
  }

  const contentType = response.headers.get("content-type") ?? ""

  if (contentType.includes("text/html")) {
    throw new Error(
      "METRICAS_CSV_URL devolvio HTML. Configura un link directo al CSV crudo diario."
    )
  }

  return Readable.fromWeb(response.body as import("stream/web").ReadableStream)
}

async function fetchCsvDownloadResponse(url: string) {
  const response = await fetch(resolveCsvDownloadUrl(url))
  const contentType = response.headers.get("content-type") ?? ""

  if (!isGoogleDriveUrl(url) || !contentType.includes("text/html")) {
    return response
  }

  const html = await response.text()
  const confirmedUrl = resolveGoogleDriveConfirmUrl(html)

  if (!confirmedUrl) {
    return new Response(html, {
      status: response.status,
      headers: response.headers,
    })
  }

  return fetch(confirmedUrl, {
    headers: {
      cookie: response.headers.get("set-cookie") ?? "",
    },
  })
}

function resolveCsvDownloadUrl(url: string) {
  const match = url.match(/drive\.google\.com\/file\/d\/([^/]+)/)

  if (!match) {
    return url
  }

  return `https://drive.google.com/uc?export=download&id=${match[1]}`
}

function isGoogleDriveUrl(url: string) {
  return url.includes("drive.google.com")
}

function isGoogleDriveFolderUrl(url: string) {
  return /drive\.google\.com\/drive\/folders\//.test(url)
}

function resolveGoogleDriveFolderId(url: string) {
  const match = url.match(/drive\.google\.com\/drive\/folders\/([^/?]+)/)
  return match?.[1] ?? null
}

function resolveGoogleDriveConfirmUrl(html: string) {
  const actionMatch = html.match(/<form[^>]+id="download-form"[^>]+action="([^"]+)"/)

  if (!actionMatch) {
    return null
  }

  const params = new URLSearchParams()
  const inputPattern = /<input[^>]+type="hidden"[^>]+name="([^"]+)"[^>]+value="([^"]*)"/g
  let inputMatch: RegExpExecArray | null

  while ((inputMatch = inputPattern.exec(html))) {
    params.set(decodeHtml(inputMatch[1]), decodeHtml(inputMatch[2]))
  }

  return `${decodeHtml(actionMatch[1])}?${params.toString()}`
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\\u003d/g, "=")
    .replace(/\\u0026/g, "&")
}

const googleDriveFolderFileIdCache = new Map<string, Promise<Record<string, string>>>()

async function resolveGoogleDriveFolderFileUrl(folderUrl: string, fileName: string) {
  const folderId = resolveGoogleDriveFolderId(folderUrl) ?? folderUrl
  const fileIds = await readGoogleDriveFolderFileIds(folderUrl)
  const fileId = fileIds[fileName]

  if (!fileId) {
    throw new Error(
      `No se encontro ${fileName} en la carpeta de Google Drive ${folderId}`
    )
  }

  return `https://drive.google.com/uc?export=download&id=${fileId}`
}

async function readGoogleDriveFolderFileIds(folderUrl: string) {
  const folderId = resolveGoogleDriveFolderId(folderUrl) ?? folderUrl
  const cached = googleDriveFolderFileIdCache.get(folderId)

  if (cached) {
    return cached
  }

  const promise = fetch(folderUrl)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`No se pudo leer la carpeta de Google Drive: ${response.status}`)
      }

      const html = decodeHtml(await response.text())
      return Object.fromEntries(
        Object.values(CACHE_FILE_NAMES).map((fileName) => [
          fileName,
          findGoogleDriveFolderFileId(html, fileName),
        ])
      )
    })
    .then((entries) =>
      Object.fromEntries(
        Object.entries(entries).filter((entry): entry is [string, string] =>
          Boolean(entry[1])
        )
      )
    )

  googleDriveFolderFileIdCache.set(folderId, promise)

  return promise
}

function findGoogleDriveFolderFileId(html: string, fileName: string) {
  const fileNameIndex = html.indexOf(fileName)

  if (fileNameIndex < 0) {
    return null
  }

  const snippet = html.slice(Math.max(0, fileNameIndex - 1200), fileNameIndex)
  const candidates = Array.from(
    snippet.matchAll(/"([a-zA-Z0-9_-]{20,})"/g),
    (match) => match[1]
  ).filter((candidate) => candidate !== resolveGoogleDriveFolderId(html))

  return candidates.at(-1) ?? null
}

async function getCsvParserConfig() {
  if (CSV_URL) {
    return {
      delimiter: process.env.METRICAS_CSV_DELIMITER || DEFAULT_CSV_DELIMITER,
      fromLine: Number(process.env.METRICAS_CSV_FROM_LINE || DEFAULT_CSV_FROM_LINE),
    }
  }

  const handle = await fs.open(CSV_PATH, "r")
  try {
    const buffer = Buffer.alloc(4096)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    const sample = buffer.toString("utf8", 0, bytesRead)
    const [firstLine = ""] = sample.split(/\r?\n/)
    const pipeCount = (firstLine.match(/\|/g) ?? []).length
    const semicolonCount = (firstLine.match(/;/g) ?? []).length
    const delimiter =
      process.env.METRICAS_CSV_DELIMITER ||
      (pipeCount > semicolonCount ? "|" : ";")
    const hasHeader =
      /aviso/i.test(firstLine) ||
      /[áa]rea de empresa/i.test(firstLine) ||
      /status de usuario/i.test(firstLine)

    return {
      delimiter,
      fromLine: Number(process.env.METRICAS_CSV_FROM_LINE || (hasHeader ? 2 : 1)),
    }
  } finally {
    await handle.close()
  }
}

async function buildSnapshotsFromCsv() {
  const rowsByDataset: Record<MetricasDatasetKey, NormalizedRow[]> = {
    alumbrado: [],
    "paisaje-urbano": [],
  }

  const input = await createCsvInputStream()
  const csvConfig = await getCsvParserConfig()
  const parser = parse({
    delimiter: csvConfig.delimiter,
    from_line: csvConfig.fromLine,
    relax_column_count: true,
    quote: false,
  })

  for await (const row of input.pipe(parser) as AsyncIterable<CsvRow>) {
    if (!isCoreCsvRow(row)) {
      continue
    }

    const datasetKey = getCsvDatasetKey(row)

    if (!datasetKey) {
      continue
    }

    rowsByDataset[datasetKey].push(normalizeCsvRow(row, datasetKey))
  }

  return {
    alumbrado: buildDatasetSnapshot(rowsByDataset.alumbrado),
    "paisaje-urbano": buildDatasetSnapshot(rowsByDataset["paisaje-urbano"]),
  }
}

let csvSnapshotBuildPromise:
  | Promise<Record<MetricasDatasetKey, DatasetSnapshot>>
  | null = null

async function readCsvSnapshot(datasetKey: MetricasDatasetKey) {
  if (!CSV_URL) {
    try {
      await fs.access(CSV_PATH)
    } catch {
      return null
    }
  }

  csvSnapshotBuildPromise ??= buildSnapshotsFromCsv().finally(() => {
    csvSnapshotBuildPromise = null
  })

  const snapshots = await csvSnapshotBuildPromise

  await Promise.all(
    (Object.entries(snapshots) as Array<[MetricasDatasetKey, DatasetSnapshot]>).map(
      ([key, snapshot]) => persistSnapshotSafely(key, snapshot)
    )
  )

  return snapshots[datasetKey]
}

export function crearResumenVacio(
  filtros: MetricasPayload["filtros"] = {
    years: [],
    prestaciones: [],
    categorias: [],
    comunas: [],
    barrios: [],
  }
): MetricasPayload {
  return {
    resumen: {
      total: 0,
      resueltos: 0,
      pendientes: 0,
      denegados: 0,
      pct_resueltos: 0,
      pct_pendientes: 0,
      pct_denegados: 0,
      generado: "Sin datos",
    },
    por_comuna: {},
    por_categoria: [],
    por_mes: [],
    motivos_baja: [],
    top_ingresos_prestacion: [],
    top_pendientes_prestacion: [],
    por_barrio: [],
    por_hora: [],
    barrio_totales: {},
    flujo_bajas: {
      resueltos: 0,
      pendientes: 0,
      denegados: 0,
      pct_resueltos: 0,
      pct_pendientes: 0,
      pct_denegados: 0,
    },
    filtros,
  }
}

const datasetCache = new Map<
  MetricasDatasetKey,
  {
    expiresAt: number
    snapshot: DatasetSnapshot
  }
>()

const responseCache = new Map<
  string,
  {
    expiresAt: number
    payload: MetricasPayload
  }
>()

async function getCachedDataset(datasetKey: MetricasDatasetKey) {
  const now = Date.now()
  const cachedDataset = datasetCache.get(datasetKey)

  if (cachedDataset && cachedDataset.expiresAt > now) {
    return cachedDataset.snapshot
  }

  const jsonSnapshot = await readJsonSnapshot(datasetKey)

  if (jsonSnapshot) {
    datasetCache.set(datasetKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      snapshot: jsonSnapshot,
    })

    return jsonSnapshot
  }

  const freshPersistedSnapshot = await readFreshPersistedSnapshot(datasetKey)

  if (freshPersistedSnapshot) {
    datasetCache.set(datasetKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      snapshot: freshPersistedSnapshot,
    })

    return freshPersistedSnapshot
  }

  const csvSnapshot = await readCsvSnapshot(datasetKey)

  if (csvSnapshot) {
    datasetCache.set(datasetKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      snapshot: csvSnapshot,
    })

    return csvSnapshot
  }

  const persistedSnapshot = await readPersistedSnapshot(datasetKey)

  if (persistedSnapshot) {
    datasetCache.set(datasetKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      snapshot: persistedSnapshot,
    })

    return persistedSnapshot
  }

  const demoSnapshot = await readDemoSnapshot(datasetKey)

  if (demoSnapshot) {
    datasetCache.set(datasetKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      snapshot: demoSnapshot,
    })

    return demoSnapshot
  }

  throw new Error(
    `No hay datos disponibles para ${datasetKey}. Configura METRICAS_CSV_URL o ejecuta npm run generate-csv-snapshots.`
  )
}

export function warmMetricasCache(datasetKey: MetricasDatasetKey = "alumbrado") {
  void getCachedDataset(datasetKey).catch((error) => {
    console.error("Error warming metricas cache", error)
  })
}

function buildCacheKey(datasetKey: MetricasDatasetKey, filters: FiltrosMetricas) {
  return [
    datasetKey,
    filters.years?.join(",") || "all",
    filters.months?.join(",") || "all",
    filters.prestacion?.join(",") || "all",
    filters.categoria?.join(",") || "all",
    filters.comuna?.join(",") || "all",
    filters.barrio?.join(",") || "all",
  ].join("|")
}

function filterDatasetRows(
  rows: NormalizedRow[],
  filters: FiltrosMetricas = {}
) {
  const selectedPrestaciones = new Set(filters.prestacion ?? [])
  const selectedCategorias = new Set(filters.categoria ?? [])
  const selectedComunas = new Set(filters.comuna ?? [])
  const selectedBarrios = new Set(filters.barrio ?? [])
  const selectedYears = new Set(filters.years ?? [])
  const selectedMonths = new Set(filters.months ?? [])
  const hasPeriodFilter = selectedYears.size > 0 || selectedMonths.size > 0

  return rows
    .filter((row) => {
      const fecha = row.fecha
      if (!fecha) return false
      if (!hasPeriodFilter) return true

      const year = String(fecha.getUTCFullYear())
      const monthKey = `${year}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`

      return selectedYears.has(year) || selectedMonths.has(monthKey)
    })
    .filter((row) =>
      selectedPrestaciones.size
        ? selectedPrestaciones.has(row.prestacion ?? "")
        : true
    )
    .filter((row) =>
      selectedCategorias.size ? selectedCategorias.has(row.categoria ?? "") : true
    )
    .filter((row) =>
      selectedComunas.size ? selectedComunas.has(row.comuna ?? "") : true
    )
    .filter((row) =>
      selectedBarrios.size ? selectedBarrios.has(row.barrio ?? "") : true
    )
    .sort((a, b) => {
      const timeA = a.fecha?.getTime() ?? 0
      const timeB = b.fecha?.getTime() ?? 0
      return timeA - timeB
    })
}

function formatExportDate(date: Date | null) {
  if (!date) {
    return ""
  }

  const day = String(date.getUTCDate()).padStart(2, "0")
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const year = String(date.getUTCFullYear())

  return `${day}/${month}/${year}`
}

function formatExportEstado(value: EstadoClave | null) {
  if (value === "resueltos") return "Resuelto"
  if (value === "pendientes") return "Pendiente"
  if (value === "denegados") return "Denegado"
  return ""
}

function formatHoraBucket(value: string | null) {
  if (!value) {
    return null
  }

  const [hours] = value.split(":")
  if (!hours) {
    return null
  }

  return `${hours.padStart(2, "0")}:00`
}

export async function getMetricasData(
  datasetKey: MetricasDatasetKey = "alumbrado",
  filters: FiltrosMetricas = {}
): Promise<MetricasPayload> {
  const cacheKey = buildCacheKey(datasetKey, filters)
  const now = Date.now()
  const cachedResponse = responseCache.get(cacheKey)

  if (cachedResponse && cachedResponse.expiresAt > now) {
    return cachedResponse.payload
  }

  const dataset = await getCachedDataset(datasetKey)
  const rowsFiltradas = filterDatasetRows(dataset.rows, filters)

  if (!rowsFiltradas.length) {
    return crearResumenVacio({
      years: dataset.filtros.years,
      prestaciones: dataset.filtros.prestaciones,
      categorias: dataset.filtros.categorias,
      comunas: dataset.filtros.comunas,
      barrios: dataset.filtros.barrios,
    })
  }

  const porComuna: Record<
    string,
    { total: number; resueltos: number; pendientes: number; denegados: number }
  > = {}
  const porCategoriaMap: Record<
    string,
    { pendiente: number; denegado: number; resuelto: number }
  > = {}
  const porMesMap: Record<
    string,
    { total: number; resueltos: number; pendientes: number; denegados: number }
  > = {}
  const motivosBajaMap: Record<string, number> = {}
  const ingresosPrestacionMap: Record<string, number> = {}
  const pendientesPrestacionMap: Record<string, number> = {}
  const porBarrioMap: Record<string, number> = {}
  const porHoraMap: Record<string, number> = {}

  let total = 0
  let resueltos = 0
  let pendientes = 0
  let denegados = 0
  let ultimaFecha: Date | null = null
  let ultMes = ""

  for (const row of rowsFiltradas) {
    const fecha = row.fecha
    const comuna = row.comuna
    const categoria = row.categoria
    const prestacion = row.prestacion
    const barrio = row.barrio
    const horaBucket = formatHoraBucket(row.horaIngreso)
    const motivoDenegado = row.motivoDenegado
    const estado = row.estado

    total += 1

    if (fecha && (!ultimaFecha || fecha > ultimaFecha)) {
      ultimaFecha = fecha
    }

    if (row.ultMes) {
      ultMes = row.ultMes
    }

    if (estado === "resueltos") resueltos += 1
    if (estado === "pendientes") pendientes += 1
    if (estado === "denegados") denegados += 1

    if (estado === "denegados" && motivoDenegado) {
      motivosBajaMap[motivoDenegado] = (motivosBajaMap[motivoDenegado] ?? 0) + 1
    }

    if (prestacion) {
      ingresosPrestacionMap[prestacion] =
        (ingresosPrestacionMap[prestacion] ?? 0) + 1
    }

    if (estado === "pendientes" && prestacion) {
      pendientesPrestacionMap[prestacion] =
        (pendientesPrestacionMap[prestacion] ?? 0) + 1
    }

    if (barrio) {
      porBarrioMap[barrio] = (porBarrioMap[barrio] ?? 0) + 1
    }

    if (horaBucket) {
      porHoraMap[horaBucket] = (porHoraMap[horaBucket] ?? 0) + 1
    }

    if (comuna) {
      porComuna[comuna] ??= {
        total: 0,
        resueltos: 0,
        pendientes: 0,
        denegados: 0,
      }
      porComuna[comuna].total += 1
      if (estado) {
        porComuna[comuna][estado] += 1
      }
    }

    if (categoria) {
      porCategoriaMap[categoria] ??= {
        pendiente: 0,
        denegado: 0,
        resuelto: 0,
      }
      if (estado === "resueltos") porCategoriaMap[categoria].resuelto += 1
      if (estado === "pendientes") porCategoriaMap[categoria].pendiente += 1
      if (estado === "denegados") porCategoriaMap[categoria].denegado += 1
    }

    if (fecha) {
      const mes = `${fecha.getUTCFullYear()}-${String(
        fecha.getUTCMonth() + 1
      ).padStart(2, "0")}`
      porMesMap[mes] ??= {
        total: 0,
        resueltos: 0,
        pendientes: 0,
        denegados: 0,
      }
      porMesMap[mes].total += 1
      if (estado) {
        porMesMap[mes][estado] += 1
      }
    }
  }

  const payload: MetricasPayload = {
    resumen: {
      total,
      resueltos,
      pendientes,
      denegados,
      pct_resueltos: total ? +((resueltos / total) * 100).toFixed(1) : 0,
      pct_pendientes: total ? +((pendientes / total) * 100).toFixed(1) : 0,
      pct_denegados: total ? +((denegados / total) * 100).toFixed(1) : 0,
      generado: formatearUltimaActualizacion(ultimaFecha, ultMes),
    },
    por_comuna: porComuna,
    por_categoria: Object.entries(porCategoriaMap)
      .map(([nombre, valores]) => ({
        nombre,
        ...valores,
        total: valores.pendiente + valores.denegado + valores.resuelto,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10),
    por_mes: Object.entries(porMesMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, valores]) => ({ mes, ...valores })),
    motivos_baja: Object.entries(motivosBajaMap)
      .map(([motivo, cantidad]) => ({
        motivo,
        cantidad,
        porcentaje: denegados
          ? +((cantidad / denegados) * 100).toFixed(1)
          : 0,
      }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 6),
    top_ingresos_prestacion: Object.entries(ingresosPrestacionMap)
      .map(([prestacion, cantidad]) => ({
        prestacion,
        cantidad,
        porcentaje: total ? +((cantidad / total) * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5),
    top_pendientes_prestacion: Object.entries(pendientesPrestacionMap)
      .map(([prestacion, cantidad]) => ({
        prestacion,
        cantidad,
        porcentaje: pendientes ? +((cantidad / pendientes) * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5),
    por_barrio: Object.entries(porBarrioMap)
      .map(([barrio, cantidad]) => ({
        barrio,
        cantidad,
        porcentaje: total ? +((cantidad / total) * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 8),
    por_hora: Object.entries(porHoraMap)
      .map(([hora, cantidad]) => ({
        hora,
        cantidad,
        porcentaje: total ? +((cantidad / total) * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => a.hora.localeCompare(b.hora)),
    barrio_totales: porBarrioMap,
    flujo_bajas: {
      resueltos,
      pendientes,
      denegados,
      pct_resueltos: total ? +((resueltos / total) * 100).toFixed(1) : 0,
      pct_pendientes: total ? +((pendientes / total) * 100).toFixed(1) : 0,
      pct_denegados: total ? +((denegados / total) * 100).toFixed(1) : 0,
    },
    filtros: {
      years: dataset.filtros.years,
      prestaciones: dataset.filtros.prestaciones,
      categorias: dataset.filtros.categorias,
      comunas: dataset.filtros.comunas,
      barrios: dataset.filtros.barrios,
    },
  }

  responseCache.set(cacheKey, {
    expiresAt: now + CACHE_TTL_MS,
    payload,
  })

  return payload
}

export async function getMetricasExportRows(
  datasetKey: MetricasDatasetKey = "alumbrado",
  filters: FiltrosMetricas = {}
): Promise<MetricasExportRow[]> {
  const dataset = await getCachedDataset(datasetKey)
  const rowsFiltradas = filterDatasetRows(dataset.rows, filters)

  return rowsFiltradas.map((row) => ({
    fecha_ingreso: formatExportDate(row.fecha),
    aviso: row.aviso ?? "",
    hora_ingreso: row.horaIngreso ?? "",
    comuna: row.comuna ?? "",
    barrio: row.barrio ?? "",
    categoria: row.categoria ?? "",
    prestacion: row.prestacion ?? "",
    grupo_planificacion: row.grupoPlanificacion ?? "",
    status_usuario: row.statusUsuario ?? "",
    estado: formatExportEstado(row.estado),
    motivo_denegado: row.motivoDenegado ?? "",
    ult_mes: row.ultMes ?? "",
  }))
}
