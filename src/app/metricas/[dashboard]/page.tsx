import { notFound } from "next/navigation"

import {
  maintenanceDashboardLinks,
  paisajeDashboardLinks,
} from "../../../lib/dashboardLinks"
import { getFlujoMantenimientoData } from "../../../lib/flujo-mantenimiento"
import {
  getMantenimientoMetricasData,
  getMetricasData,
  type MetricasDatasetKey,
} from "../../../lib/metricas"
import {
  MANTENIMIENTO_DATASET_KEYS,
  type MantenimientoDatasetKey,
} from "../../../lib/metricas-csv"
import MantenimientoDashboardPage from "../MantenimientoDashboardPage"
import FlujoMantenimientoScreen from "../flujo-mantenimiento/screen"
import MetricasScreen from "../screen"

export const dynamic = "force-dynamic"

type Props = {
  params: {
    dashboard: string
  }
  searchParams?: {
    area?: string | string[]
  }
}

const MANTENIMIENTO_DASHBOARDS: Partial<
  Record<
    MantenimientoDatasetKey,
    {
      apiPath: string
      subtitle: string
    }
  >
> = {
  "calzada-emui": {
    apiPath: "/api/calzada-emui",
    subtitle:
      "Subsecretaria de Mantenimiento - Ente de Mantenimiento Urbano Integral",
  },
  "mobiliario-urbano": {
    apiPath: "/api/mobiliario-urbano",
    subtitle: "Subsecretaria de Mantenimiento - Mobiliario Urbano",
  },
  pluviales: {
    apiPath: "/api/pluviales",
    subtitle:
      "Subsecretaria de Mantenimiento - Direccion General de Sistemas Pluviales",
  },
  "vias-peatonales": {
    apiPath: "/api/vias-peatonales",
    subtitle:
      "Subsecretaria de Mantenimiento - Direccion General de Vias Peatonales",
  },
}

async function loadMetricas(datasetKey: MetricasDatasetKey) {
  try {
    return await getMetricasData(datasetKey)
  } catch (error) {
    console.error(error)
    return null
  }
}

async function renderFlujoMantenimiento(searchParams: Props["searchParams"]) {
  const rawArea = Array.isArray(searchParams?.area)
    ? searchParams.area[0]
    : searchParams?.area
  const initialArea = MANTENIMIENTO_DATASET_KEYS.includes(
    rawArea as MantenimientoDatasetKey
  )
    ? (rawArea as MantenimientoDatasetKey)
    : "all"
  let data = null

  try {
    data = await getFlujoMantenimientoData({
      areas: initialArea === "all" ? [] : [initialArea],
    })
  } catch (error) {
    console.error(error)
  }

  return <FlujoMantenimientoScreen initialData={data} initialArea={initialArea} />
}

export default async function DashboardPage({ params, searchParams }: Props) {
  const { dashboard } = params

  if (dashboard === "flujo-mantenimiento") {
    return renderFlujoMantenimiento(searchParams)
  }

  if (dashboard === "mantenimiento") {
    let data = null

    try {
      data = await getMantenimientoMetricasData()
    } catch (error) {
      console.error(error)
    }

    return (
      <MetricasScreen
        data={data}
        apiPath="/api/mantenimiento"
        title="Ministerio de Espacio Publico"
        subtitle="Subsecretaria de Mantenimiento - Todas las áreas"
        dashboardSelectorLinks={maintenanceDashboardLinks}
        datasetKey="all"
      />
    )
  }

  if (dashboard === "alumbrado") {
    return (
      <MetricasScreen
        data={await loadMetricas("alumbrado")}
        apiPath="/api/metricas"
        dashboardSelectorLinks={maintenanceDashboardLinks}
        datasetKey="alumbrado"
      />
    )
  }

  if (dashboard === "paisaje-urbano") {
    return (
      <MetricasScreen
        data={await loadMetricas("paisaje-urbano")}
        apiPath="/api/paisaje-urbano"
        title="Ministerio de Espacio Publico"
        subtitle="Subsecretaria de Paisaje Urbano - Direccion General de Conservacion de Paisaje Urbano"
        externalLabel="Ver mas en Power BI"
        dashboardSelectorLinks={paisajeDashboardLinks}
      />
    )
  }

  if (dashboard === "ferias") {
    return (
      <MetricasScreen
        data={await loadMetricas("ferias")}
        apiPath="/api/ferias"
        subtitle="Subsecretaria de Paisaje Urbano - Ferias"
        externalUrl=""
        dashboardSelectorLinks={paisajeDashboardLinks}
      />
    )
  }

  const mantenimientoDashboard =
    MANTENIMIENTO_DASHBOARDS[dashboard as MantenimientoDatasetKey]

  if (mantenimientoDashboard) {
    return (
      <MantenimientoDashboardPage
        datasetKey={dashboard as MantenimientoDatasetKey}
        apiPath={mantenimientoDashboard.apiPath}
        subtitle={mantenimientoDashboard.subtitle}
      />
    )
  }

  notFound()
}
