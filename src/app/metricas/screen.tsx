"use client"

import "./metricas.css"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import type { SelectChangeEvent } from "@mui/material"
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined"
import ArrowOutwardRoundedIcon from "@mui/icons-material/ArrowOutwardRounded"
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined"
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded"
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded"

import KPICards from "./components/KPICards"
import ComunasHeatmap from "./components/ComunasHeatmap"
import BarriosFocusMap from "./components/BarriosFocusMap"
import IngresosPorBarrioChart from "./components/IngresosPorBarrioChart"
import IngresosPorHoraChart from "./components/IngresosPorHoraChart"
import MotivosBajaChart from "./components/MotivosBajaChart"
import TopIngresosPrestacionChart from "./components/TopIngresosPrestacionChart"
import TopPendientesPrestacionChart from "./components/TopPendientesPrestacionChart"
import FlujoBajasChart from "./components/FlujoBajasChart"
import formatComuna from "./components/formatComuna"
import formatPrestacion from "./components/formatPrestacion"
import DashboardSelector from "./DashboardSelector"
import { getBarriosForComuna } from "../../lib/barrios"
import { dashboardLinks, type DashboardLink } from "../../lib/dashboardLinks"

interface MetricasData {
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
    top_prestaciones?: Array<{
      prestacion: string
      cantidad: number
      porcentaje: number
    }>
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

interface Props {
  data: MetricasData | null
  apiPath?: string
  title?: string
  subtitle?: string
  externalUrl?: string
  externalLabel?: string
  dashboardSelectorLinks?: DashboardLink[]
}

type FilterSelections = {
  years: string[]
  months: string[]
  prestaciones: string[]
  categorias: string[]
  comunas: string[]
  barrios: string[]
}

type ActiveFilterItem =
  | { key: string; label: string; type: "year"; value: string }
  | { key: string; label: string; type: "month"; value: string }
  | { key: string; label: string; type: "prestacion"; value: string }
  | { key: string; label: string; type: "categoria"; value: string }
  | { key: string; label: string; type: "comuna"; value: string }
  | { key: string; label: string; type: "barrio"; value: string }

const MONTHS = [
  { value: "01", label: "Enero" },
  { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Mayo" },
  { value: "06", label: "Junio" },
  { value: "07", label: "Julio" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
]

const DEFAULT_EXTERNAL_URL =
  "https://app.powerbi.com/view?r=eyJrIjoiZWNkNzg0NjktYWU5Yi00ZDYxLTg3ODMtZTMwNzczMGRlNDFhIiwidCI6IjIzNzc0NzJlLTgwMDQtNDY0OC04NDU2LWJkOTY4N2FmYTE1MCIsImMiOjR9&pageName=abae79b05ddb05215571"

const FilterDrawer = dynamic(() => import("./FilterDrawer"), {
  ssr: false,
  loading: () => null,
})

const FilterFab = dynamic(() => import("./FilterFab"), {
  ssr: false,
  loading: () => null,
})

function appendValues(params: URLSearchParams, key: string, values: string[]) {
  for (const value of [...values].sort()) {
    params.append(key, value)
  }
}

function buildMetricasQuery({
  apiPath,
  years,
  months,
  prestaciones,
  categorias,
  comunas,
  barrios,
}: FilterSelections & { apiPath: string }) {
  const params = new URLSearchParams()

  if (years.length) {
    appendValues(params, "years", years)
  }

  if (months.length) {
    appendValues(params, "months", months)
  }

  if (prestaciones.length) {
    appendValues(params, "prestacion", prestaciones)
  }

  if (categorias.length) {
    appendValues(params, "categoria", categorias)
  }

  if (comunas.length) {
    appendValues(params, "comuna", comunas)
  }

  if (barrios.length) {
    appendValues(params, "barrio", barrios)
  }

  const query = params.toString()
  return query ? `${apiPath}?${query}` : apiPath
}

function areSelectionsEqual(a: FilterSelections, b: FilterSelections) {
  return (
    a.years.join("|") === b.years.join("|") &&
    a.months.join("|") === b.months.join("|") &&
    a.prestaciones.join("|") === b.prestaciones.join("|") &&
    a.categorias.join("|") === b.categorias.join("|") &&
    a.comunas.join("|") === b.comunas.join("|") &&
    a.barrios.join("|") === b.barrios.join("|")
  )
}

export default function MetricasScreen({
  data,
  apiPath = "/api/metricas",
  title = "Ministerio de Espacio Publico",
  subtitle = "Subsecretaria de Mantenimiento - Direccion General de Alumbrado",
  externalUrl = DEFAULT_EXTERNAL_URL,
  externalLabel = "Ver mas en Power BI",
  dashboardSelectorLinks = dashboardLinks,
}: Props) {
  const [dashboardData, setDashboardData] = useState<MetricasData | null>(data)
  const [barrioReferenceTotals, setBarrioReferenceTotals] = useState<
    Record<string, number>
  >(data?.barrio_totales ?? {})
  const [selectedYears, setSelectedYears] = useState<string[]>([])
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])
  const [expandedYears, setExpandedYears] = useState<string[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedPrestaciones, setSelectedPrestaciones] = useState<string[]>([])
  const [selectedCategorias, setSelectedCategorias] = useState<string[]>([])
  const [selectedComunas, setSelectedComunas] = useState<string[]>([])
  const [selectedBarrios, setSelectedBarrios] = useState<string[]>([])
  const previousSelectionsRef = useRef<FilterSelections>({
    years: [],
    months: [],
    prestaciones: [],
    categorias: [],
    comunas: [],
    barrios: [],
  })
  const dashboardRequestRef = useRef(0)

  const monthsByYear = useMemo(
    () =>
      (dashboardData?.filtros.years ?? []).reduce<Record<string, string[]>>(
        (acc, year) => {
          acc[year] = MONTHS.map(({ value }) => `${year}-${value}`)
          return acc
        },
        {}
      ),
    [dashboardData?.filtros.years]
  )

  const activeComuna = selectedComunas.at(-1) ?? null
  const exportPath = apiPath.endsWith("/api/metricas")
    ? `${apiPath}/export`
    : `${apiPath}/export`

  const hasActiveFilter =
    selectedYears.length > 0 ||
    selectedMonths.length > 0 ||
    selectedPrestaciones.length > 0 ||
    selectedCategorias.length > 0 ||
    selectedComunas.length > 0 ||
    selectedBarrios.length > 0

  const activeFilterItems: ActiveFilterItem[] = [
    ...selectedYears.map((year) => ({
      key: `year-${year}`,
      label: year,
      type: "year" as const,
      value: year,
    })),
    ...selectedMonths.map((monthKey) => {
      const [year, month] = monthKey.split("-")
      const monthLabel =
        MONTHS.find((item) => item.value === month)?.label ?? month
      return {
        key: `month-${monthKey}`,
        label: `${monthLabel} ${year}`,
        type: "month" as const,
        value: monthKey,
      }
    }),
    ...selectedPrestaciones.map((item) => ({
      key: `prestacion-${item}`,
      label: formatPrestacion(item),
      type: "prestacion" as const,
      value: item,
    })),
    ...selectedCategorias.map((item) => ({
      key: `categoria-${item}`,
      label: item,
      type: "categoria" as const,
      value: item,
    })),
    ...selectedComunas.map((item) => ({
      key: `comuna-${item}`,
      label: formatComuna(item),
      type: "comuna" as const,
      value: item,
    })),
    ...selectedBarrios.map((item) => ({
      key: `barrio-${item}`,
      label: item,
      type: "barrio" as const,
      value: item,
    })),
  ]

  const downloadUrl = buildMetricasQuery({
    apiPath: exportPath,
    years: selectedYears,
    months: selectedMonths,
    prestaciones: selectedPrestaciones,
    categorias: selectedCategorias,
    comunas: selectedComunas,
    barrios: selectedBarrios,
  })

  const removeActiveFilter = (item: ActiveFilterItem) => {
    if (item.type === "year") {
      setSelectedYears((current) =>
        current.filter((value) => value !== item.value)
      )
      setSelectedMonths((current) =>
        current.filter((monthKey) => !monthKey.startsWith(`${item.value}-`))
      )
      return
    }

    if (item.type === "month") {
      setSelectedMonths((current) =>
        current.filter((value) => value !== item.value)
      )
      return
    }

    if (item.type === "prestacion") {
      setSelectedPrestaciones((current) =>
        current.filter((value) => value !== item.value)
      )
      return
    }

    if (item.type === "categoria") {
      setSelectedCategorias((current) =>
        current.filter((value) => value !== item.value)
      )
      return
    }

    if (item.type === "comuna") {
      setSelectedComunas((current) =>
        current.filter((value) => value !== item.value)
      )
      return
    }

    setSelectedBarrios((current) =>
      current.filter((value) => value !== item.value)
    )
  }

  const handleMultiSelectChange = (
    event: SelectChangeEvent<string[]>,
    setter: (next: string[]) => void
  ) => {
    const value = event.target.value
    setter(typeof value === "string" ? value.split(",") : value)
  }

  const toggleYearExpansion = (year: string) => {
    setExpandedYears((current) =>
      current.includes(year)
        ? current.filter((item) => item !== year)
        : [...current, year]
    )
  }

  const toggleYear = (year: string) => {
    const yearMonths = monthsByYear[year] ?? []
    const allMonthsSelected = yearMonths.every((month) =>
      selectedMonths.includes(month)
    )
    const yearSelected = selectedYears.includes(year)

    if (yearSelected || allMonthsSelected) {
      setSelectedYears((current) => current.filter((item) => item !== year))
      setSelectedMonths((current) =>
        current.filter((month) => !yearMonths.includes(month))
      )
      return
    }

    setSelectedYears((current) =>
      current.includes(year) ? current : [...current, year]
    )
    setSelectedMonths((current) =>
      current.filter((month) => !yearMonths.includes(month))
    )
  }

  const toggleMonth = (year: string, monthKey: string) => {
    const yearMonths = monthsByYear[year] ?? []

    setSelectedYears((current) => current.filter((item) => item !== year))
    setSelectedMonths((current) => {
      const next = current.includes(monthKey)
        ? current.filter((item) => item !== monthKey)
        : [...current, monthKey]

      const selectedCount = yearMonths.filter((month) =>
        next.includes(month)
      ).length

      if (selectedCount === yearMonths.length && yearMonths.length > 0) {
        setSelectedYears((years) =>
          years.includes(year) ? years : [...years, year]
        )
        return next.filter((month) => !yearMonths.includes(month))
      }

      return next
    })
  }

  const clearFilter = () => {
    setSelectedYears([])
    setSelectedMonths([])
    setSelectedPrestaciones([])
    setSelectedCategorias([])
    setSelectedComunas([])
    setSelectedBarrios([])
  }

  useEffect(() => {
    const currentSelections = {
      years: selectedYears,
      months: selectedMonths,
      prestaciones: selectedPrestaciones,
      categorias: selectedCategorias,
      comunas: selectedComunas,
      barrios: selectedBarrios,
    }

    if (areSelectionsEqual(previousSelectionsRef.current, currentSelections)) {
      return
    }

    previousSelectionsRef.current = currentSelections

    const url = buildMetricasQuery({
      apiPath,
      ...currentSelections,
    })

    const requestId = dashboardRequestRef.current + 1
    dashboardRequestRef.current = requestId
    const controller = new AbortController()

    setIsRefreshing(true)
    fetch(url, { signal: controller.signal })
      .then((res) => res.json())
      .then((payload) => {
        if (dashboardRequestRef.current === requestId) {
          setDashboardData(payload)
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }
        console.error("Error actualizando filtros", error)
      })
      .finally(() => {
        if (dashboardRequestRef.current === requestId) {
          setIsRefreshing(false)
        }
      })

    return () => controller.abort()
  }, [
    apiPath,
    selectedYears,
    selectedMonths,
    selectedPrestaciones,
    selectedCategorias,
    selectedComunas,
    selectedBarrios,
  ])

  useEffect(() => {
    const url = buildMetricasQuery({
      apiPath,
      years: selectedYears,
      months: selectedMonths,
      prestaciones: selectedPrestaciones,
      categorias: selectedCategorias,
      comunas: selectedComunas,
      barrios: [],
    })

    fetch(url)
      .then((res) => res.json())
      .then((payload: MetricasData) => {
        setBarrioReferenceTotals(payload.barrio_totales ?? {})
      })
      .catch(() => {
        // Keep the last successful totals if this auxiliary refresh fails.
      })
  }, [
    apiPath,
    selectedYears,
    selectedMonths,
    selectedPrestaciones,
    selectedCategorias,
    selectedComunas,
  ])

  useEffect(() => {
    if (!activeComuna) {
      if (selectedBarrios.length) {
        setSelectedBarrios([])
      }
      return
    }

    const allowedBarrios = new Set(getBarriosForComuna(activeComuna))

    setSelectedBarrios((current) => {
      const next = current.filter((barrio) => allowedBarrios.has(barrio))
      return next.length === current.length ? current : next
    })
  }, [activeComuna, selectedBarrios])

  if (!dashboardData) {
    return (
      <div className="metricas-empty-state">
        <p>No se pudieron cargar las metricas.</p>
      </div>
    )
  }

  return (
    <div className="metricas-page">
      <div className="metricas-shell">
        <div className="metricas-content">
          <header className="metricas-topbar">
            <div className="metricas-topbar-copy">
              <Link href="/metricas" className="metricas-home-link">
                <ArrowBackRoundedIcon fontSize="small" />
                <span>Volver al inicio</span>
              </Link>
              <p className="metricas-eyebrow">Centro de control</p>
              <h2 className="metricas-title">{title}</h2>
              <p className="metricas-subtitle">{subtitle}</p>
            </div>

            <div className="metricas-summary-card">
              <div className="metricas-summary-icon">
                <InsightsOutlinedIcon fontSize="inherit" />
              </div>
              <div>
                <p className="metricas-summary-eyebrow">Resumen ejecutivo</p>
                <p className="metricas-summary-text">
                  Dashboard ejecutivo con filtros interactivos y lectura por comuna.
                </p>
              </div>
            </div>
          </header>

          <div className="metricas-body">
            <DashboardSelector
              compact
              links={dashboardSelectorLinks}
              eyebrow="Direcciones Generales"
              title="Tableros disponibles"
              description="Selecciona uno de los accesos disponibles para esta subsecretaria."
            />

            {hasActiveFilter ? (
              <div className="metricas-filter-strip">
                <div className="metricas-filter-strip-label">Filtros activos</div>
                <div className="metricas-filter-strip-items">
                  {activeFilterItems.map((item) => (
                    <span key={item.key} className="metricas-filter-pill">
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <KPICards resumen={dashboardData.resumen} />

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-5 xl:items-stretch">
              <div className="grid grid-cols-1 gap-4 xl:col-span-3">
                <ComunasHeatmap
                  data={dashboardData.por_comuna}
                  selectedComunas={selectedComunas}
                  onToggleComuna={(comuna) =>
                    setSelectedComunas((current) => {
                      const isSameComuna =
                        current.length === 1 && current[0] === comuna

                      if (isSameComuna) {
                        setSelectedBarrios([])
                        return []
                      }

                      setSelectedBarrios([])
                      return [comuna]
                    })
                  }
                />

                <BarriosFocusMap
                  activeComuna={activeComuna}
                  barrioTotales={barrioReferenceTotals}
                  selectedBarrios={selectedBarrios}
                  onToggleBarrio={(barrio) =>
                    setSelectedBarrios((current) =>
                      current.includes(barrio)
                        ? current.filter((item) => item !== barrio)
                        : [...current, barrio]
                    )
                  }
                />

                <div className="metricas-surface-card">
                  <IngresosPorBarrioChart items={dashboardData.por_barrio} />
                </div>
              </div>

              <div className="metricas-surface-card xl:col-span-2">
                <FlujoBajasChart
                  resueltos={dashboardData.flujo_bajas.resueltos}
                  pendientes={dashboardData.flujo_bajas.pendientes}
                  denegados={dashboardData.flujo_bajas.denegados}
                  pctResueltos={dashboardData.flujo_bajas.pct_resueltos}
                  pctPendientes={dashboardData.flujo_bajas.pct_pendientes}
                  pctDenegados={dashboardData.flujo_bajas.pct_denegados}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-5">
              <div className="order-1 grid grid-cols-1 gap-4 sm:gap-5 xl:order-2 xl:col-span-2">
                <div className="metricas-surface-card">
                  <TopIngresosPrestacionChart
                    items={dashboardData.top_ingresos_prestacion}
                  />
                </div>

                <div className="metricas-surface-card">
                  <TopPendientesPrestacionChart
                    items={dashboardData.top_pendientes_prestacion}
                  />
                </div>
              </div>

              <div className="order-2 metricas-surface-card xl:order-1 xl:col-span-3">
                <MotivosBajaChart items={dashboardData.motivos_baja} />
              </div>
            </div>

            <div className="metricas-surface-card">
              <IngresosPorHoraChart items={dashboardData.por_hora} />
            </div>
          </div>

          <footer className="metricas-footer-actions">
            <div className="metricas-footer-meta">
              <CalendarMonthOutlinedIcon fontSize="inherit" />
              <span>Actualizado: {dashboardData.resumen.generado || "Sin fecha"}</span>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <a
                href={downloadUrl}
                className="metricas-footer-button metricas-footer-button-secondary"
              >
                <span>Descargar con filtros actuales</span>
                <DownloadRoundedIcon fontSize="small" />
              </a>
              {externalUrl ? (
                <button
                  type="button"
                  onClick={() =>
                    window.open(externalUrl, "_blank", "noopener,noreferrer")
                  }
                  className="metricas-footer-button"
                >
                  <span>{externalLabel}</span>
                  <ArrowOutwardRoundedIcon fontSize="small" />
                </button>
              ) : null}
            </div>
          </footer>
        </div>
      </div>

      <div className="fixed bottom-6 right-6 z-40 sm:bottom-8 sm:right-8">
        <FilterFab
          hasActiveFilter={hasActiveFilter}
          activeFilterCount={activeFilterItems.length}
          isRefreshing={isRefreshing}
          onOpen={() => setDrawerOpen(true)}
        />
      </div>

      {drawerOpen ? (
        <FilterDrawer
          dashboardData={dashboardData}
          drawerOpen={drawerOpen}
          hasActiveFilter={hasActiveFilter}
          selectedYears={selectedYears}
          selectedMonths={selectedMonths}
          expandedYears={expandedYears}
          selectedPrestaciones={selectedPrestaciones}
          selectedCategorias={selectedCategorias}
          selectedComunas={selectedComunas}
          selectedBarrios={selectedBarrios}
          activeFilterItems={activeFilterItems}
          years={dashboardData.filtros.years}
          monthsByYear={monthsByYear}
          onClose={() => setDrawerOpen(false)}
          onClearFilter={clearFilter}
          onRemoveFilter={removeActiveFilter}
          onToggleYearExpansion={toggleYearExpansion}
          onToggleYear={toggleYear}
          onToggleMonth={toggleMonth}
          onPrestacionesChange={(event) =>
            handleMultiSelectChange(event, setSelectedPrestaciones)
          }
          onCategoriasChange={(event) =>
            handleMultiSelectChange(event, setSelectedCategorias)
          }
          onComunasChange={(event) =>
            handleMultiSelectChange(event, setSelectedComunas)
          }
          onBarriosChange={(event) =>
            handleMultiSelectChange(event, setSelectedBarrios)
          }
        />
      ) : null}
    </div>
  )
}
