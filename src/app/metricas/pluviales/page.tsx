import { warmMetricasCache } from "../../../lib/metricas"
import MantenimientoDashboardPage from "../MantenimientoDashboardPage"

export const dynamic = "force-dynamic"

warmMetricasCache("pluviales")

export default function PluvialesPage() {
  return (
    <MantenimientoDashboardPage
      datasetKey="pluviales"
      apiPath="/api/pluviales"
      subtitle="Subsecretaria de Mantenimiento - Direccion General de Sistemas Pluviales"
    />
  )
}
