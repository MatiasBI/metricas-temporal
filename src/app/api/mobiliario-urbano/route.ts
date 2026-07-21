import { NextRequest } from "next/server"

import { warmMetricasCache } from "../../../lib/metricas"
import { handleMetricasRequest } from "../../../lib/metricas-route"

export const dynamic = "force-dynamic"

warmMetricasCache("mobiliario-urbano")

export function GET(req: NextRequest) {
  return handleMetricasRequest(req, "mobiliario-urbano")
}
