import { NextRequest, NextResponse } from "next/server"
import { getMetricasData, warmMetricasCache } from "../../../lib/metricas"

export const dynamic = "force-dynamic"

warmMetricasCache()

function getFilterValues(req: NextRequest, key: string) {
  const values = req.nextUrl.searchParams.getAll(key)
  return values.flatMap((value) => value.split(",")).filter(Boolean)
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getMetricasData("alumbrado", {
      years: getFilterValues(req, "years"),
      months: getFilterValues(req, "months"),
      prestacion: getFilterValues(req, "prestacion"),
      categoria: getFilterValues(req, "categoria"),
      comuna: getFilterValues(req, "comuna"),
      barrio: getFilterValues(req, "barrio"),
    })

    return NextResponse.json(payload)
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: "Error leyendo metricas desde la fuente configurada" },
      { status: 500 }
    )
  }
}
