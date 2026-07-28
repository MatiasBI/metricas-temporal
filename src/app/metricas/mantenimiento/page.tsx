import { maintenanceDashboardLinks } from "../../../lib/dashboardLinks"
import { getMantenimientoMetricasData } from "../../../lib/metricas"
import MetricasScreen from "../screen"

export const dynamic = "force-dynamic"

async function getData() {
  try {
    return await getMantenimientoMetricasData()
  } catch (error) {
    console.error(error)
    return null
  }
}

export default async function MantenimientoPage() {
  const data = await getData()

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
