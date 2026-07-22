import { maintenanceDashboardLinks } from "../../lib/dashboardLinks"
import {
  getMetricasData,
} from "../../lib/metricas"
import type { MantenimientoDatasetKey } from "../../lib/metricas-csv"
import MetricasScreen from "./screen"

type Props = {
  datasetKey: MantenimientoDatasetKey
  apiPath: string
  subtitle: string
}

export default async function MantenimientoDashboardPage({
  datasetKey,
  apiPath,
  subtitle,
}: Props) {
  let data = null

  try {
    data = await getMetricasData(datasetKey)
  } catch (error) {
    console.error(error)
  }

  return (
    <MetricasScreen
      data={data}
      apiPath={apiPath}
      title="Ministerio de Espacio Publico"
      subtitle={subtitle}
      dashboardSelectorLinks={maintenanceDashboardLinks}
      datasetKey={datasetKey}
    />
  )
}
