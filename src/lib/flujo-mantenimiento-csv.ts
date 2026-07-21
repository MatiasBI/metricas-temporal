import {
  METRICAS_CSV_COLUMN_COUNT,
  getMantenimientoDatasetKey,
  type MantenimientoDatasetKey,
} from "./metricas-csv"

export type FlujoEstado = "resueltos" | "pendientes" | "denegados"

export type FlujoCsvRow = {
  datasetKey: MantenimientoDatasetKey
  fechaIngreso: Date
  fechaBaja: Date | null
  prestacion: string
  statusUsuario: string
  estado: FlujoEstado
}

const COLUMN = {
  clase: 1,
  fechaIngreso: 2,
  statusUsuario: 4,
  grupoPlanificacion: 5,
  prestacion: 13,
  fechaBaja: 14,
} as const

const CLASES_MANTENIMIENTO = new Set(["SU", "RE"])

const STATUS_MAP: Record<string, FlujoEstado> = {
  REOK: "resueltos",
  TERC: "denegados",
  SERV: "denegados",
  FREN: "denegados",
  IM01: "denegados",
  IM02: "denegados",
  IM03: "denegados",
  IM04: "denegados",
  IM05: "denegados",
  CANC: "denegados",
  OTRA: "denegados",
  OPER: "pendientes",
  INIC: "pendientes",
  PLAN: "pendientes",
  VERI: "pendientes",
  PROG: "pendientes",
}

export const FLUJO_MOTIVOS_BAJA: Record<string, string> = {
  REOK: "Resuelto con éxito",
  TERC: "Realizado por terceros",
  SERV: "Responsabilidad empresa de servicio público",
  FREN: "Responsabilidad frentista",
  IM01: "Falla inexistente",
  IM02: "Falta información",
  IM03: "Imposibilidad técnica",
  IM04: "Fuera de competencia",
  IM05: "Cancelado por el usuario",
  CANC: "Cancelado",
  OTRA: "Fuera de SAP - Otras Areas",
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function get(row: string[], index: number) {
  return row[index] ?? ""
}

function parseDate(value: string) {
  const raw = normalizeText(value)
  if (!/^\d{8}$/.test(raw) || raw === "00000000") return null

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

export function parseFlujoMantenimientoCsvRow(
  rawRow: string[]
): FlujoCsvRow | null {
  if (rawRow.length !== METRICAS_CSV_COLUMN_COUNT) return null

  const clase = normalizeText(get(rawRow, COLUMN.clase)).toUpperCase()
  if (!CLASES_MANTENIMIENTO.has(clase)) return null

  const fechaIngreso = parseDate(get(rawRow, COLUMN.fechaIngreso))
  const statusUsuario = normalizeText(
    get(rawRow, COLUMN.statusUsuario)
  ).toUpperCase()
  const estado = STATUS_MAP[statusUsuario] ?? null
  const datasetKey = getMantenimientoDatasetKey(
    get(rawRow, COLUMN.grupoPlanificacion)
  )
  const prestacion = normalizeText(get(rawRow, COLUMN.prestacion))

  if (!fechaIngreso || !estado || !datasetKey || !prestacion) return null

  const fechaBaja =
    estado === "pendientes"
      ? null
      : parseDate(get(rawRow, COLUMN.fechaBaja))

  return {
    datasetKey,
    fechaIngreso,
    fechaBaja,
    prestacion,
    statusUsuario,
    estado,
  }
}
