import { NextRequest, NextResponse } from "next/server"

import {
  getFlujoMantenimientoData,
  warmFlujoMantenimientoCache,
} from "../../../lib/flujo-mantenimiento"

export const dynamic = "force-dynamic"

warmFlujoMantenimientoCache()

function values(req: NextRequest, key: string) {
  return req.nextUrl.searchParams
    .getAll(key)
    .flatMap((value) => value.split(","))
    .filter(Boolean)
}

export async function GET(req: NextRequest) {
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
