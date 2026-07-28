"use client"

import "../metricas.css"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { Card, DonutChart } from "@tremor/react"
import type { SvgIconComponent } from "@mui/icons-material"
import type { SelectChangeEvent } from "@mui/material"
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded"
import AddCircleOutlineRoundedIcon from "@mui/icons-material/AddCircleOutlineRounded"
import AppsRoundedIcon from "@mui/icons-material/AppsRounded"
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined"
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded"
import ConstructionOutlinedIcon from "@mui/icons-material/ConstructionOutlined"
import DirectionsWalkOutlinedIcon from "@mui/icons-material/DirectionsWalkOutlined"
import HourglassBottomRoundedIcon from "@mui/icons-material/HourglassBottomRounded"
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined"
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined"
import WaterDropOutlinedIcon from "@mui/icons-material/WaterDropOutlined"
import WeekendOutlinedIcon from "@mui/icons-material/WeekendOutlined"
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { FlujoMantenimientoPayload } from "../../../lib/flujo-mantenimiento"
import type { MantenimientoDatasetKey } from "../../../lib/metricas-csv"
import { getBarriosForComuna } from "../../../lib/barrios"
import BarriosFocusMap from "../components/BarriosFocusMap"
import ComunasHeatmap from "../components/ComunasHeatmap"
import formatComuna from "../components/formatComuna"
import formatPrestacion from "../components/formatPrestacion"
import IngresosPorBarrioChart from "../components/IngresosPorBarrioChart"
import IngresosPorHoraChart from "../components/IngresosPorHoraChart"
import MetricVersionSwitch from "../components/MetricVersionSwitch"
import MotivosBajaChart from "../components/MotivosBajaChart"
import TopIngresosPrestacionChart from "../components/TopIngresosPrestacionChart"
import TopPendientesPrestacionChart from "../components/TopPendientesPrestacionChart"
import styles from "./flujo.module.css"

type Props = {
  initialData: FlujoMantenimientoPayload | null
  initialArea: MantenimientoDatasetKey | "all"
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

const MONTH_LABELS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

const numberFormatter = new Intl.NumberFormat("es-AR")

const AREA_ICONS: Record<MantenimientoDatasetKey, SvgIconComponent> = {
  alumbrado: LightbulbOutlinedIcon,
  "calzada-emui": ConstructionOutlinedIcon,
  "mobiliario-urbano": WeekendOutlinedIcon,
  pluviales: WaterDropOutlinedIcon,
  "vias-peatonales": DirectionsWalkOutlinedIcon,
}

const FilterDrawer = dynamic(() => import("../FilterDrawer"), {
  ssr: false,
  loading: () => null,
})

const FilterFab = dynamic(() => import("../FilterFab"), {
  ssr: false,
  loading: () => null,
})

function monthLabel(value: string, short = false) {
  const [year, month] = value.split("-")
  const label = MONTH_LABELS[Number(month) - 1] ?? value
  return short ? `${label.slice(0, 3)} ${year.slice(2)}` : `${label} ${year}`
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("es-AR", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value)
}

function appendValues(params: URLSearchParams, key: string, values: string[]) {
  for (const value of [...values].sort()) params.append(key, value)
}

function buildFlowQuery(
  area: MantenimientoDatasetKey | "all",
  selections: FilterSelections,
  includeBarrios = true
) {
  const params = new URLSearchParams()
  appendValues(params, "years", selections.years)
  appendValues(params, "months", selections.months)
  appendValues(params, "prestacion", selections.prestaciones)
  appendValues(params, "categoria", selections.categorias)
  appendValues(params, "comuna", selections.comunas)
  if (includeBarrios) appendValues(params, "barrio", selections.barrios)
  if (area !== "all") params.append("area", area)
  return `/api/flujo-mantenimiento?${params.toString()}`
}

export default function FlujoMantenimientoScreen({ initialData, initialArea }: Props) {
  const [data, setData] = useState(initialData)
  const [selectedArea, setSelectedArea] = useState<MantenimientoDatasetKey | "all">(
    initialArea
  )
  const [selectedYears, setSelectedYears] = useState<string[]>(
    initialData?.filtros.selectedYears ?? []
  )
  const [selectedMonths, setSelectedMonths] = useState<string[]>(
    initialData?.filtros.selectedMonths ?? []
  )
  const [selectedPrestaciones, setSelectedPrestaciones] = useState<string[]>(
    initialData?.filtros.selectedPrestaciones ?? []
  )
  const [selectedCategorias, setSelectedCategorias] = useState<string[]>(
    initialData?.filtros.selectedCategorias ?? []
  )
  const [selectedComunas, setSelectedComunas] = useState<string[]>(
    initialData?.filtros.selectedComunas ?? []
  )
  const [selectedBarrios, setSelectedBarrios] = useState<string[]>(
    initialData?.filtros.selectedBarrios ?? []
  )
  const [expandedYears, setExpandedYears] = useState<string[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [barrioReferenceTotals, setBarrioReferenceTotals] = useState<
    Record<string, number>
  >(initialData?.barrio_totales ?? {})
  const firstRequest = useRef(true)
  const activeComuna = selectedComunas.at(-1) ?? null

  const monthsByYear = useMemo(
    () =>
      (initialData?.filtros.years ?? []).reduce<Record<string, string[]>>(
        (acc, year) => {
          acc[year] = (initialData?.filtros.months ?? []).filter((month) =>
            month.startsWith(`${year}-`)
          )
          return acc
        },
        {}
      ),
    [initialData?.filtros.months, initialData?.filtros.years]
  )

  const chartData = useMemo(
    () =>
      (data?.por_mes ?? []).map((row) => ({
        ...row,
        etiqueta: monthLabel(row.mes, true),
      })),
    [data?.por_mes]
  )

  const activeFilterItems = useMemo<ActiveFilterItem[]>(
    () => [
      ...selectedYears.map((year) => ({
        key: `year-${year}`,
        label: year,
        type: "year" as const,
        value: year,
      })),
      ...selectedMonths.map((monthKey) => {
        const [year, month] = monthKey.split("-")
        return {
          key: `month-${monthKey}`,
          label: `${MONTH_LABELS[Number(month) - 1] ?? month} ${year}`,
          type: "month" as const,
          value: monthKey,
        }
      }),
      ...selectedPrestaciones.map((value) => ({
        key: `prestacion-${value}`,
        label: formatPrestacion(value),
        type: "prestacion" as const,
        value,
      })),
      ...selectedCategorias.map((value) => ({
        key: `categoria-${value}`,
        label: value,
        type: "categoria" as const,
        value,
      })),
      ...selectedComunas.map((value) => ({
        key: `comuna-${value}`,
        label: formatComuna(value),
        type: "comuna" as const,
        value,
      })),
      ...selectedBarrios.map((value) => ({
        key: `barrio-${value}`,
        label: value,
        type: "barrio" as const,
        value,
      })),
    ],
    [
      selectedBarrios,
      selectedCategorias,
      selectedComunas,
      selectedMonths,
      selectedPrestaciones,
      selectedYears,
    ]
  )

  const hasActiveFilter = activeFilterItems.length > 0

  useEffect(() => {
    if (firstRequest.current) {
      firstRequest.current = false
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      const selections = {
        years: selectedYears,
        months: selectedMonths,
        prestaciones: selectedPrestaciones,
        categorias: selectedCategorias,
        comunas: selectedComunas,
        barrios: selectedBarrios,
      }

      setIsRefreshing(true)
      try {
        const response = await fetch(buildFlowQuery(selectedArea, selections), {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error("No se pudo actualizar el flujo")
        setData((await response.json()) as FlujoMantenimientoPayload)
      } catch (error) {
        if (!controller.signal.aborted) console.error(error)
      } finally {
        if (!controller.signal.aborted) setIsRefreshing(false)
      }
    }, 120)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [
    selectedArea,
    selectedBarrios,
    selectedCategorias,
    selectedComunas,
    selectedMonths,
    selectedPrestaciones,
    selectedYears,
  ])

  useEffect(() => {
    const controller = new AbortController()
    const selections = {
      years: selectedYears,
      months: selectedMonths,
      prestaciones: selectedPrestaciones,
      categorias: selectedCategorias,
      comunas: selectedComunas,
      barrios: [] as string[],
    }

    fetch(buildFlowQuery(selectedArea, selections, false), {
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((payload: FlujoMantenimientoPayload) => {
        setBarrioReferenceTotals(payload.barrio_totales ?? {})
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Error actualizando la referencia barrial", error)
        }
      })

    return () => controller.abort()
  }, [
    selectedArea,
    selectedCategorias,
    selectedComunas,
    selectedMonths,
    selectedPrestaciones,
    selectedYears,
  ])

  useEffect(() => {
    if (!activeComuna) {
      if (selectedBarrios.length) setSelectedBarrios([])
      return
    }

    const allowedBarrios = new Set(getBarriosForComuna(activeComuna))
    setSelectedBarrios((current) => {
      const next = current.filter((barrio) => allowedBarrios.has(barrio))
      return next.length === current.length ? current : next
    })
  }, [activeComuna, selectedBarrios])

  function removeActiveFilter(item: ActiveFilterItem) {
    if (item.type === "year") {
      setSelectedYears((current) => current.filter((value) => value !== item.value))
      setSelectedMonths((current) =>
        current.filter((value) => !value.startsWith(`${item.value}-`))
      )
      return
    }
    if (item.type === "month") {
      setSelectedMonths((current) => current.filter((value) => value !== item.value))
      return
    }
    if (item.type === "prestacion") {
      setSelectedPrestaciones((current) => current.filter((value) => value !== item.value))
      return
    }
    if (item.type === "categoria") {
      setSelectedCategorias((current) => current.filter((value) => value !== item.value))
      return
    }
    if (item.type === "comuna") {
      setSelectedComunas((current) => current.filter((value) => value !== item.value))
      return
    }
    setSelectedBarrios((current) => current.filter((value) => value !== item.value))
  }

  function handleMultiSelectChange(
    event: SelectChangeEvent<string[]>,
    setter: (next: string[]) => void
  ) {
    const value = event.target.value
    setter(typeof value === "string" ? value.split(",") : value)
  }

  function toggleYearExpansion(year: string) {
    setExpandedYears((current) =>
      current.includes(year)
        ? current.filter((value) => value !== year)
        : [...current, year]
    )
  }

  function toggleYear(year: string) {
    const yearMonths = monthsByYear[year] ?? []
    const allMonthsSelected = yearMonths.every((month) =>
      selectedMonths.includes(month)
    )
    const yearSelected = selectedYears.includes(year)

    if (yearSelected || allMonthsSelected) {
      setSelectedYears((current) => current.filter((value) => value !== year))
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

  function toggleMonth(year: string, monthKey: string) {
    const yearMonths = monthsByYear[year] ?? []
    setSelectedYears((current) => current.filter((value) => value !== year))
    setSelectedMonths((current) => {
      const next = current.includes(monthKey)
        ? current.filter((value) => value !== monthKey)
        : [...current, monthKey]

      if (
        yearMonths.length > 0 &&
        yearMonths.every((month) => next.includes(month))
      ) {
        setSelectedYears((current) =>
          current.includes(year) ? current : [...current, year]
        )
        return next.filter((month) => !yearMonths.includes(month))
      }
      return next
    })
  }

  function clearFilter() {
    setSelectedYears([])
    setSelectedMonths([])
    setSelectedPrestaciones([])
    setSelectedCategorias([])
    setSelectedComunas([])
    setSelectedBarrios([])
  }

  function changeArea(area: MantenimientoDatasetKey | "all") {
    setSelectedArea(area)
    setSelectedPrestaciones([])
    setSelectedCategorias([])
    setSelectedComunas([])
    setSelectedBarrios([])
    const nextUrl =
      area === "all"
        ? window.location.pathname
        : `${window.location.pathname}?area=${encodeURIComponent(area)}`
    window.history.replaceState(null, "", nextUrl)
  }

  if (!data) {
    return (
      <main className={styles.emptyState}>
        No se pudo cargar el flujo de mantenimiento.
      </main>
    )
  }

  const stockLabel = data.resumen.stockMes
    ? monthLabel(data.resumen.stockMes)
    : "Sin periodo"
  const generatedLabel = new Date(data.resumen.generado).toLocaleDateString("es-AR")
  const topIngresos = data.top_ingresos_prestacion.slice(0, 5).map((row) => ({
    ...row,
    porcentaje: data.resumen.ingresos
      ? Number(((row.cantidad / data.resumen.ingresos) * 100).toFixed(1))
      : 0,
  }))
  const topPendientes = data.top_pendientes_prestacion.slice(0, 5).map((row) => ({
    ...row,
    porcentaje: data.resumen.pendientes
      ? Number(((row.cantidad / data.resumen.pendientes) * 100).toFixed(1))
      : 0,
  }))

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
              <h2 className="metricas-title">Ministerio de Espacio Publico</h2>
              <p className="metricas-subtitle">
                Subsecretaria de Mantenimiento - Tablero de flujo de reclamos
              </p>
            </div>

            <div className="metricas-summary-card">
              <div className="metricas-summary-icon">
                <InsightsOutlinedIcon fontSize="inherit" />
              </div>
              <div>
                <p className="metricas-summary-eyebrow">Resumen ejecutivo</p>
                <p className="metricas-summary-text">
                  Altas, bajas y stock mensual con apertura territorial y operativa.
                </p>
              </div>
            </div>
          </header>

          <div className="metricas-body">
            <MetricVersionSwitch activeMode="flow" area={selectedArea} />

            <section className={styles.areaPanel} aria-label="Area de mantenimiento">
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelEyebrow}>Direcciones generales</p>
                  <h2 className={styles.panelTitle}>Tableros disponibles</h2>
                </div>
                <p className={styles.panelDescription}>
                  Vista consolidada y detalle por área de mantenimiento.
                </p>
              </div>

              <div className={styles.areaGrid}>
                <button
                  type="button"
                  className={`${styles.areaButton} ${selectedArea === "all" ? styles.activeArea : ""}`.trim()}
                  onClick={() => changeArea("all")}
                >
                  <span className={styles.areaIcon}><AppsRoundedIcon fontSize="inherit" /></span>
                  <span className={styles.areaLabel}>Todas las áreas</span>
                  <span className={styles.areaSubtitle}>Vista consolidada de mantenimiento</span>
                </button>
                {data.filtros.areas.map((area) => {
                  const AreaIcon = AREA_ICONS[area.value]

                  return (
                    <button
                      type="button"
                      key={area.value}
                      className={`${styles.areaButton} ${selectedArea === area.value ? styles.activeArea : ""}`.trim()}
                      onClick={() => changeArea(area.value)}
                    >
                      <span className={styles.areaIcon}><AreaIcon fontSize="inherit" /></span>
                      <span className={styles.areaLabel}>{area.label}</span>
                      <span className={styles.areaSubtitle}>Flujo mensual del área</span>
                    </button>
                  )
                })}
              </div>
            </section>

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

            <section className={styles.kpiGrid} aria-label="Indicadores principales">
              <div className={styles.kpiCard}>
                <div className={styles.kpiTop}>
                  <span>Ingresos</span>
                  <span className={`${styles.kpiIcon} ${styles.kpiIngresos}`}><AddCircleOutlineRoundedIcon /></span>
                </div>
                <strong>{numberFormatter.format(data.resumen.ingresos)}</strong>
                <p>Altas registradas en el período.</p>
              </div>
              <div className={styles.kpiCard}>
                <div className={styles.kpiTop}>
                  <span>Bajas</span>
                  <span className={`${styles.kpiIcon} ${styles.kpiBajas}`}><CheckCircleOutlineRoundedIcon /></span>
                </div>
                <strong>{numberFormatter.format(data.resumen.bajas)}</strong>
                <p>Movimientos de cierre del período.</p>
              </div>
              <div className={styles.kpiCard}>
                <div className={styles.kpiTop}>
                  <span>Stock pendientes</span>
                  <span className={`${styles.kpiIcon} ${styles.kpiPendientes}`}><HourglassBottomRoundedIcon /></span>
                </div>
                <strong>{numberFormatter.format(data.resumen.pendientes)}</strong>
                <p>Situación al cierre de {stockLabel}.</p>
              </div>
            </section>

        <Card className={styles.chartCard}>
          <div className={styles.cardHeading}>
            <div><h2>Flujo de altas, bajas y pendientes</h2><p>Movimiento mensual y stock al cierre</p></div>
          </div>
          <div className={styles.composedChart}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="#e7edf1" vertical={false} />
                <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis yAxisId="movimientos" tickLine={false} axisLine={false} width={44} tickFormatter={compactNumber} />
                <YAxis yAxisId="stock" orientation="right" tickLine={false} axisLine={false} width={44} tickFormatter={compactNumber} />
                <Tooltip formatter={(value: number, name: string) => [numberFormatter.format(value), name]} />
                <Legend />
                <Bar yAxisId="movimientos" dataKey="ingresos" name="Altas" fill="#35a9e0" radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Bar yAxisId="movimientos" dataKey="bajas" name="Bajas" fill="#309d5c" radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Line yAxisId="stock" type="monotone" dataKey="pendientes" name="Pendientes" stroke="#e39a22" strokeWidth={3} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <section className={styles.territorySection}>
          <div className={styles.sectionHeading}>
            <div>
              <p>Lectura territorial</p>
              <h2>Ingresos del período por ubicación</h2>
            </div>
            <span>Universo del tablero de flujo · clases SU y RE</span>
          </div>

          <div className={styles.territoryGrid}>
            <div className={styles.mapStack}>
              <ComunasHeatmap
                data={data.por_comuna}
                selectedComunas={selectedComunas}
                onToggleComuna={(comuna) =>
                  setSelectedComunas((current) => {
                    const isSameComuna = current.length === 1 && current[0] === comuna
                    setSelectedBarrios([])
                    return isSameComuna ? [] : [comuna]
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
            </div>

            <div className={`metricas-surface-card ${styles.barrioRanking}`}>
              <IngresosPorBarrioChart items={data.por_barrio} />
            </div>
          </div>
        </section>

        <section className={styles.donutGrid}>
          <Card className={styles.donutCard}>
            <div className={styles.cardHeading}><div><h2>Flujo de bajas</h2><p>Resultado de las bajas</p></div></div>
            <DonutChart
              className={styles.donut}
              data={data.flujo_bajas}
              category="cantidad"
              index="nombre"
              colors={["emerald", "red"]}
              valueFormatter={(value) => numberFormatter.format(value)}
              showAnimation
            />
            <div className={styles.legendList}>
              {data.flujo_bajas.map((row) => (
                <div key={row.nombre}><span>{row.nombre}</span><strong>{row.porcentaje.toLocaleString("es-AR")}%</strong></div>
              ))}
            </div>
          </Card>

          <Card className={styles.donutCard}>
            <div className={styles.cardHeading}><div><h2>Pendientes por área</h2><p>Stock de {stockLabel}</p></div></div>
            <DonutChart
              className={styles.donut}
              data={data.pendientes_por_area}
              category="cantidad"
              index="area"
              colors={["cyan", "amber", "emerald", "rose", "indigo"]}
              valueFormatter={(value) => numberFormatter.format(value)}
              showAnimation
            />
            <div className={styles.legendList}>
              {data.pendientes_por_area.map((row) => (
                <div key={row.area}><span>{row.area}</span><strong>{numberFormatter.format(row.cantidad)}</strong></div>
              ))}
            </div>
          </Card>
        </section>

        <section className={styles.insightGrid}>
          <div className={`metricas-surface-card ${styles.motivosCard}`}>
            <MotivosBajaChart
              items={data.motivos_baja}
              description="Distribución de las bajas dentro del período seleccionado."
            />
          </div>
          <div className={styles.rankingStack}>
            <div className="metricas-surface-card">
              <TopIngresosPrestacionChart items={topIngresos} />
            </div>
            <div className="metricas-surface-card">
              <TopPendientesPrestacionChart items={topPendientes} />
            </div>
          </div>
        </section>

        <Card className={`${styles.chartCard} ${styles.hourCard}`}>
          <IngresosPorHoraChart
            items={data.por_hora}
            description="Altas registradas por franja horaria dentro del período seleccionado."
          />
        </Card>

          </div>

          <footer className="metricas-footer-actions">
            <div className="metricas-footer-meta">
              <CalendarMonthOutlinedIcon fontSize="inherit" />
              <span>Fuente: Avisos · Actualizado: {generatedLabel}</span>
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
          dashboardData={data}
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
          years={data.filtros.years}
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
