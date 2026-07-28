import { getFlujoMantenimientoData } from "../../../lib/flujo-mantenimiento"
import {
  MANTENIMIENTO_DATASET_KEYS,
  type MantenimientoDatasetKey,
} from "../../../lib/metricas-csv"
import FlujoMantenimientoScreen from "./screen"

export const dynamic = "force-dynamic"

type Props = {
  searchParams?: { area?: string | string[] }
}

export default async function FlujoMantenimientoPage({ searchParams }: Props) {
  let data = null
  const rawArea = Array.isArray(searchParams?.area)
    ? searchParams?.area[0]
    : searchParams?.area
  const initialArea = MANTENIMIENTO_DATASET_KEYS.includes(
    rawArea as MantenimientoDatasetKey
  )
    ? (rawArea as MantenimientoDatasetKey)
    : "all"

  try {
    data = await getFlujoMantenimientoData({
      areas: initialArea === "all" ? [] : [initialArea],
    })
  } catch (error) {
    console.error(error)
  }

  return <FlujoMantenimientoScreen initialData={data} initialArea={initialArea} />
}
