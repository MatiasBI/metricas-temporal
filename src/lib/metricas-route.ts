import { NextRequest, NextResponse } from "next/server"

import { buildMetricasExcelContent } from "./metricas-export"
import {
  getMetricasData,
  getMetricasExportRows,
  type MetricasDatasetKey,
} from "./metricas"

function getFilterValues(req: NextRequest, key: string) {
  const values = req.nextUrl.searchParams.getAll(key)
  return values.flatMap((value) => value.split(",")).filter(Boolean)
}

function getFilters(req: NextRequest) {
  return {
    years: getFilterValues(req, "years"),
    months: getFilterValues(req, "months"),
    prestacion: getFilterValues(req, "prestacion"),
    categoria: getFilterValues(req, "categoria"),
    comuna: getFilterValues(req, "comuna"),
    barrio: getFilterValues(req, "barrio"),
  }
}

export async function handleMetricasRequest(
  req: NextRequest,
  datasetKey: MetricasDatasetKey
) {
  try {
    return NextResponse.json(
      await getMetricasData(datasetKey, getFilters(req))
    )
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Error leyendo metricas desde la fuente configurada" },
      { status: 500 }
    )
  }
}

export async function handleMetricasExportRequest(
  req: NextRequest,
  datasetKey: MetricasDatasetKey
) {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const rows = await getMetricasExportRows(datasetKey, getFilters(req))
    const content = buildMetricasExcelContent(rows, datasetKey)

    return new NextResponse(content, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${datasetKey}-${today}.xls"`,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Error exportando metricas filtradas" },
      { status: 500 }
    )
  }
}
