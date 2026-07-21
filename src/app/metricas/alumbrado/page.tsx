import { getMetricasData, warmMetricasCache } from "../../../lib/metricas"
import { maintenanceDashboardLinks } from "../../../lib/dashboardLinks"
import MetricasScreen from "../screen"

export const dynamic = "force-dynamic"

warmMetricasCache()

async function getData() {
  try {
    return await getMetricasData("alumbrado")
  } catch (error) {
    console.error(error)
    return null
  }
}

export default async function AlumbradoPage() {
  const data = await getData()
  return (
    <MetricasScreen
      data={data}
      apiPath="/api/metricas"
      dashboardSelectorLinks={maintenanceDashboardLinks}
    />
  )
}
