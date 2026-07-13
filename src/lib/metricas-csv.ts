export type MetricasDatasetKey = "alumbrado" | "paisaje-urbano"

export type MetricasCsvNormalizedRow = {
  aviso: string | null
  fecha: Date | null
  horaIngreso: string | null
  comuna: string | null
  barrio: string | null
  categoria: string | null
  prestacion: string | null
  grupoPlanificacion: string | null
  statusUsuario: string | null
  motivoDenegado: string | null
  estado: "resueltos" | "pendientes" | "denegados" | null
  ultMes: string
}

export type MetricasCsvParseResult = {
  datasetKey: MetricasDatasetKey
  row: MetricasCsvNormalizedRow
}

export const METRICAS_CSV_COLUMN_COUNT = 17

const COLUMN = {
  aviso: 0,
  fechaAviso: 2,
  horaIngreso: 3,
  statusGeneral: 4,
  grupoPlanificacion: 5,
  barrio: 6,
  comuna: 12,
  prestacion: 13,
} as const

const VALID_COMUNAS = new Set(
  Array.from({ length: 15 }, (_, index) =>
    `C${String(index + 1).padStart(2, "0")}`
  )
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

const STATUS_MAP: Record<
  string,
  "resueltos" | "pendientes" | "denegados"
> = {
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

function get(row: string[], index: number) {
  return row[index] ?? ""
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function normalizeAviso(value: string) {
  const aviso = normalizeText(value)
  return aviso.replace(/^0+(?=\d)/, "") || null
}

function normalizeComuna(value: string) {
  const comuna = normalizeText(value).toUpperCase()
  return VALID_COMUNAS.has(comuna) ? comuna : null
}

function parseDate(value: string) {
  const raw = normalizeText(value)

  if (!/^\d{8}$/.test(raw)) return null

  const year = Number(raw.slice(0, 4))
  const month = Number(raw.slice(4, 6))
  const day = Number(raw.slice(6, 8))
  const parsed = new Date(Date.UTC(year, month - 1, day))

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null
  }

  return parsed
}

function parseTime(value: string) {
  const raw = normalizeText(value).padStart(6, "0")

  if (!/^\d{6}$/.test(raw)) return null

  const hours = Number(raw.slice(0, 2))
  const minutes = Number(raw.slice(2, 4))
  const seconds = Number(raw.slice(4, 6))

  if (hours > 23 || minutes > 59 || seconds > 59) return null

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

function getDatasetKey(
  prestacion: string,
  grupoPlanificacion: string
): MetricasDatasetKey | null {
  if (
    grupoPlanificacion.startsWith("AL") &&
    !ALUMBRADO_GRUPOS_EXCLUIDOS.has(grupoPlanificacion) &&
    ALUMBRADO_PRESTACIONES.has(prestacion)
  ) {
    return "alumbrado"
  }

  if (PAISAJE_PRESTACIONES.has(prestacion)) {
    return "paisaje-urbano"
  }

  return null
}

export function parseMetricasCsvRow(
  rawRow: string[]
): MetricasCsvParseResult | null {
  if (rawRow.length !== METRICAS_CSV_COLUMN_COUNT) return null

  const aviso = normalizeAviso(get(rawRow, COLUMN.aviso))
  const fecha = parseDate(get(rawRow, COLUMN.fechaAviso))
  const prestacion = normalizeText(get(rawRow, COLUMN.prestacion))
  const grupoPlanificacion = normalizeText(
    get(rawRow, COLUMN.grupoPlanificacion)
  ).toUpperCase()
  const statusUsuario = normalizeText(
    get(rawRow, COLUMN.statusGeneral)
  ).toUpperCase()
  const estado = STATUS_MAP[statusUsuario] ?? null
  const datasetKey = getDatasetKey(prestacion, grupoPlanificacion)

  if (!aviso || !fecha || !prestacion || !estado || !datasetKey) return null

  return {
    datasetKey,
    row: {
      aviso,
      fecha,
      horaIngreso: parseTime(get(rawRow, COLUMN.horaIngreso)),
      comuna: normalizeComuna(get(rawRow, COLUMN.comuna)),
      barrio: normalizeText(get(rawRow, COLUMN.barrio)) || null,
      categoria: prestacion,
      prestacion,
      grupoPlanificacion: grupoPlanificacion || null,
      statusUsuario,
      motivoDenegado:
        estado === "denegados" ? DENEGADO_MOTIVOS[statusUsuario] ?? null : null,
      estado,
      ultMes: "",
    },
  }
}
