import { warmMetricasCache } from "../../../lib/metricas"
import MantenimientoDashboardPage from "../MantenimientoDashboardPage"

export const dynamic = "force-dynamic"

warmMetricasCache("mobiliario-urbano")

export default function MobiliarioUrbanoPage() {
  return (
    <MantenimientoDashboardPage
      datasetKey="mobiliario-urbano"
      apiPath="/api/mobiliario-urbano"
      subtitle="Subsecretaria de Mantenimiento - Mobiliario Urbano"
    />
  )
}
