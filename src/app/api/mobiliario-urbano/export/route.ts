import { NextRequest } from "next/server"

import { handleMetricasExportRequest } from "../../../../lib/metricas-route"

export const dynamic = "force-dynamic"

export function GET(req: NextRequest) {
  return handleMetricasExportRequest(req, "mobiliario-urbano")
}
