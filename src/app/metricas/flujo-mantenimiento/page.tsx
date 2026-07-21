import { getFlujoMantenimientoData } from "../../../lib/flujo-mantenimiento"
import FlujoMantenimientoScreen from "./screen"

export const dynamic = "force-dynamic"

export default async function FlujoMantenimientoPage() {
  let data = null

  try {
    data = await getFlujoMantenimientoData({ years: ["2024"] })
  } catch (error) {
    console.error(error)
  }

  return <FlujoMantenimientoScreen initialData={data} />
}
