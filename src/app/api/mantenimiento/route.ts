import { NextRequest } from "next/server"

import { handleMantenimientoMetricasRequest } from "../../../lib/metricas-route"

export const dynamic = "force-dynamic"

export function GET(req: NextRequest) {
  return handleMantenimientoMetricasRequest(req)
}
