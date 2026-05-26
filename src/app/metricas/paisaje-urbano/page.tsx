import { getMetricasData, warmMetricasCache } from "../../../lib/metricas"
import { dashboardLinks } from "../../../lib/dashboardLinks"
import MetricasScreen from "../screen"

export const dynamic = "force-dynamic"

warmMetricasCache("paisaje-urbano")

async function getData() {
  try {
    return await getMetricasData("paisaje-urbano")
  } catch (error) {
    console.error(error)
    return null
  }
}

export default async function PaisajeUrbanoPage() {
  const data = await getData()

  return (
    <MetricasScreen
      data={data}
      apiPath="/api/paisaje-urbano"
      title="Ministerio de Espacio Publico"
      subtitle="Subsecretaria de Paisaje Urbano - Direccion General de Conservacion de Paisaje Urbano"
      externalLabel="Ver mas en Power BI"
      dashboardSelectorLinks={dashboardLinks.filter(
        (link) => link.href === "/metricas/paisaje-urbano"
      )}
    />
  )
}
