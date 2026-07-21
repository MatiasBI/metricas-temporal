import { maintenanceDashboardLinks } from "../../lib/dashboardLinks"
import {
  getMetricasData,
  type MetricasDatasetKey,
} from "../../lib/metricas"
import MetricasScreen from "./screen"

type Props = {
  datasetKey: MetricasDatasetKey
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
    />
  )
}
