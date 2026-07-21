import { warmMetricasCache } from "../../../lib/metricas"
import MantenimientoDashboardPage from "../MantenimientoDashboardPage"

export const dynamic = "force-dynamic"

warmMetricasCache("vias-peatonales")

export default function ViasPeatonalesPage() {
  return (
    <MantenimientoDashboardPage
      datasetKey="vias-peatonales"
      apiPath="/api/vias-peatonales"
      subtitle="Subsecretaria de Mantenimiento - Direccion General de Vias Peatonales"
    />
  )
}
