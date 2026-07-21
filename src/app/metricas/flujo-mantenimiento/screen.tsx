"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  BarList,
  Card,
  DonutChart,
} from "@tremor/react"
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded"
import AddCircleOutlineRoundedIcon from "@mui/icons-material/AddCircleOutlineRounded"
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded"
import HourglassBottomRoundedIcon from "@mui/icons-material/HourglassBottomRounded"
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined"
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
import styles from "./flujo.module.css"

type Props = {
  initialData: FlujoMantenimientoPayload | null
}

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

export default function FlujoMantenimientoScreen({ initialData }: Props) {
  const [data, setData] = useState(initialData)
  const initialYear = initialData?.filtros.selectedYears[0] ?? "2024"
  const initialYearMonths =
    initialData?.filtros.months.filter((month) => month.startsWith(initialYear)) ?? []
  const [selectedYear, setSelectedYear] = useState(initialYear)
  const [fromMonth, setFromMonth] = useState(initialYearMonths[0]?.slice(5) ?? "01")
  const [toMonth, setToMonth] = useState(initialYearMonths.at(-1)?.slice(5) ?? "12")
  const [selectedArea, setSelectedArea] = useState("all")
  const [loading, setLoading] = useState(false)
  const firstRequest = useRef(true)

  const availableMonths = useMemo(
    () =>
      (data?.filtros.months ?? [])
        .filter((month) => month.startsWith(selectedYear))
        .map((month) => month.slice(5)),
    [data?.filtros.months, selectedYear]
  )

  const chartData = useMemo(
    () =>
      (data?.por_mes ?? []).map((row) => ({
        ...row,
        etiqueta: monthLabel(row.mes, true),
      })),
    [data?.por_mes]
  )

  useEffect(() => {
    if (firstRequest.current) {
      firstRequest.current = false
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams()
      params.append("years", selectedYear)
      const start = Number(fromMonth)
      const end = Number(toMonth)
      const first = Math.min(start, end)
      const last = Math.max(start, end)

      for (const month of availableMonths) {
        const value = Number(month)
        if (value >= first && value <= last) {
          params.append("months", `${selectedYear}-${month}`)
        }
      }
      if (selectedArea !== "all") params.append("area", selectedArea)

      setLoading(true)
      try {
        const response = await fetch(`/api/flujo-mantenimiento?${params}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error("No se pudo actualizar el flujo")
        setData((await response.json()) as FlujoMantenimientoPayload)
      } catch (error) {
        if (!controller.signal.aborted) console.error(error)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 120)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [availableMonths, fromMonth, selectedArea, selectedYear, toMonth])

  function changeYear(year: string) {
    const months = (data?.filtros.months ?? []).filter((month) => month.startsWith(year))
    setSelectedYear(year)
    setFromMonth(months[0]?.slice(5) ?? "01")
    setToMonth(months.at(-1)?.slice(5) ?? "12")
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

  return (
    <div className={styles.page}>
      <main className={styles.shell}>
        <Link href="/metricas" className={styles.backLink}>
          <ArrowBackRoundedIcon />
          Tableros
        </Link>

        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Subsecretaría de Mantenimiento</p>
            <h1>Flujo de reclamos de mantenimiento</h1>
            <p className={styles.subtitle}>Alternativa con lógica mensual equivalente al tablero Power BI</p>
          </div>
          <div className={styles.sourceMeta}>
            <span>Fuente: Avisos</span>
            <span>Actualizado {generatedLabel}</span>
          </div>
        </header>

        <section className={styles.areaControl} aria-label="Area de mantenimiento">
          <button
            type="button"
            className={selectedArea === "all" ? styles.activeArea : undefined}
            onClick={() => setSelectedArea("all")}
          >
            Todas
          </button>
          {data.filtros.areas.map((area) => (
            <button
              type="button"
              key={area.value}
              className={selectedArea === area.value ? styles.activeArea : undefined}
              onClick={() => setSelectedArea(area.value)}
            >
              {area.label}
            </button>
          ))}
        </section>

        <section className={styles.filterBar} aria-label="Periodo">
          <label>
            Año
            <select value={selectedYear} onChange={(event) => changeYear(event.target.value)}>
              {data.filtros.years.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>
          <label>
            Desde
            <select value={fromMonth} onChange={(event) => setFromMonth(event.target.value)}>
              {availableMonths.map((month) => (
                <option key={month} value={month}>{MONTH_LABELS[Number(month) - 1]}</option>
              ))}
            </select>
          </label>
          <label>
            Hasta
            <select value={toMonth} onChange={(event) => setToMonth(event.target.value)}>
              {availableMonths.map((month) => (
                <option key={month} value={month}>{MONTH_LABELS[Number(month) - 1]}</option>
              ))}
            </select>
          </label>
          <div className={styles.stockDate} title="Los pendientes son el stock al cierre del último mes seleccionado">
            <InfoOutlinedIcon />
            Stock al cierre de {stockLabel}
          </div>
          {loading && <span className={styles.loading}>Actualizando</span>}
        </section>

        <section className={styles.kpiGrid} aria-label="Indicadores principales">
          <Card className={styles.kpiCard}>
            <div className={`${styles.kpiIcon} ${styles.kpiIngresos}`}><AddCircleOutlineRoundedIcon /></div>
            <div><span>Ingresos</span><strong>{numberFormatter.format(data.resumen.ingresos)}</strong></div>
          </Card>
          <Card className={styles.kpiCard}>
            <div className={`${styles.kpiIcon} ${styles.kpiBajas}`}><CheckCircleOutlineRoundedIcon /></div>
            <div><span>Bajas</span><strong>{numberFormatter.format(data.resumen.bajas)}</strong></div>
          </Card>
          <Card className={styles.kpiCard}>
            <div className={`${styles.kpiIcon} ${styles.kpiPendientes}`}><HourglassBottomRoundedIcon /></div>
            <div><span>Stock pendientes</span><strong>{numberFormatter.format(data.resumen.pendientes)}</strong></div>
          </Card>
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

        <section className={styles.analysisGrid}>
          <Card className={styles.tableCard}>
            <div className={styles.cardHeading}><div><h2>Motivos de baja</h2><p>Distribución en el período seleccionado</p></div></div>
            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th>Motivo</th><th>Cantidad</th><th>%</th></tr></thead>
                <tbody>
                  {data.motivos_baja.map((row) => (
                    <tr key={row.motivo}><td>{row.motivo}</td><td>{numberFormatter.format(row.cantidad)}</td><td>{row.porcentaje.toLocaleString("es-AR")}%</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

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

        <section className={styles.prestacionGrid}>
          <Card className={styles.barListCard}>
            <div className={styles.cardHeading}><div><h2>Principales ingresos</h2><p>Prestaciones con más altas</p></div></div>
            <BarList
              data={data.top_ingresos_prestacion.map((row) => ({ name: row.prestacion, value: row.cantidad }))}
              valueFormatter={(value) => numberFormatter.format(value)}
              color="cyan"
            />
          </Card>
          <Card className={styles.barListCard}>
            <div className={styles.cardHeading}><div><h2>Principales pendientes</h2><p>Prestaciones en el stock de cierre</p></div></div>
            <BarList
              data={data.top_pendientes_prestacion.map((row) => ({ name: row.prestacion, value: row.cantidad }))}
              valueFormatter={(value) => numberFormatter.format(value)}
              color="amber"
            />
          </Card>
        </section>
      </main>
    </div>
  )
}
