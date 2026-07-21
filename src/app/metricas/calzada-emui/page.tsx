import { warmMetricasCache } from "../../../lib/metricas"
import MantenimientoDashboardPage from "../MantenimientoDashboardPage"

export const dynamic = "force-dynamic"

warmMetricasCache("calzada-emui")

export default function CalzadaEmuiPage() {
  return (
    <MantenimientoDashboardPage
      datasetKey="calzada-emui"
      apiPath="/api/calzada-emui"
      subtitle="Subsecretaria de Mantenimiento - Ente de Mantenimiento Urbano Integral"
    />
  )
}
