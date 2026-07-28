import { NextRequest } from "next/server"

import { handleMantenimientoMetricasExportRequest } from "../../../../lib/metricas-route"

export const dynamic = "force-dynamic"

export function GET(req: NextRequest) {
  return handleMantenimientoMetricasExportRequest(req)
}
