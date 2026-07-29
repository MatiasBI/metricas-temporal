import { NextRequest, NextResponse } from "next/server"

import { getFlujoMantenimientoData } from "../../../lib/flujo-mantenimiento"
import type { MetricasDatasetKey } from "../../../lib/metricas"
import {
  handleMantenimientoMetricasExportRequest,
  handleMantenimientoMetricasRequest,
  handleMetricasExportRequest,
  handleMetricasRequest,
} from "../../../lib/metricas-route"

export const dynamic = "force-dynamic"

const DATASET_BY_ROUTE: Record<string, MetricasDatasetKey> = {
  metricas: "alumbrado",
  "calzada-emui": "calzada-emui",
  ferias: "ferias",
  "mobiliario-urbano": "mobiliario-urbano",
  "paisaje-urbano": "paisaje-urbano",
  pluviales: "pluviales",
  "vias-peatonales": "vias-peatonales",
}

type RouteContext = {
  params: {
    route?: string[]
  }
}

function values(req: NextRequest, key: string) {
  return req.nextUrl.searchParams
    .getAll(key)
    .flatMap((value) => value.split(","))
    .filter(Boolean)
}

async function handleFlujoMantenimientoRequest(req: NextRequest) {
  try {
    return NextResponse.json(
      await getFlujoMantenimientoData({
        years: values(req, "years"),
        months: values(req, "months"),
        areas: values(req, "area"),
        prestacion: values(req, "prestacion"),
        categoria: values(req, "categoria"),
        comuna: values(req, "comuna"),
        barrio: values(req, "barrio"),
      })
    )
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Error leyendo el flujo de mantenimiento" },
      { status: 500 }
    )
  }
}

function notFound() {
  return NextResponse.json({ error: "Ruta API no encontrada" }, { status: 404 })
}

export function GET(req: NextRequest, { params }: RouteContext) {
  const [resource, action, ...extraSegments] = params.route ?? []

  if (!resource || extraSegments.length) {
    return notFound()
  }

  if (resource === "flujo-mantenimiento") {
    return action ? notFound() : handleFlujoMantenimientoRequest(req)
  }

  if (resource === "mantenimiento") {
    if (!action) {
      return handleMantenimientoMetricasRequest(req)
    }

    return action === "export"
      ? handleMantenimientoMetricasExportRequest(req)
      : notFound()
  }

  const datasetKey = DATASET_BY_ROUTE[resource]
  if (!datasetKey) {
    return notFound()
  }

  if (!action) {
    return handleMetricasRequest(req, datasetKey)
  }

  return action === "export"
    ? handleMetricasExportRequest(req, datasetKey)
    : notFound()
}
