import { getMetricasData, warmMetricasCache } from "../../../lib/metricas"
import MetricasScreen from "../screen"

export const dynamic = "force-dynamic"

warmMetricasCache("ferias")

async function getData() {
  try {
    return await getMetricasData("ferias")
  } catch (error) {
    console.error(error)
    return null
  }
}

export default async function FeriasPage() {
  const data = await getData()

  return (
    <MetricasScreen
      data={data}
      apiPath="/api/ferias"
      subtitle="Ferias - Seguimiento operativo"
      externalUrl=""
      showDashboardSelector={false}
    />
  )
}
