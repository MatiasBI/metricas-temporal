import Link from "next/link"
import CheckRoundedIcon from "@mui/icons-material/CheckRounded"
import CompareArrowsRoundedIcon from "@mui/icons-material/CompareArrowsRounded"

import type { MantenimientoDatasetKey } from "../../../lib/metricas-csv"
import styles from "./MetricVersionSwitch.module.css"

type MetricMode = "current" | "flow"

type Props = {
  activeMode: MetricMode
  area: MantenimientoDatasetKey | "all"
}

const ORIGINAL_ROUTES: Record<MantenimientoDatasetKey, string> = {
  alumbrado: "/metricas/alumbrado",
  "calzada-emui": "/metricas/calzada-emui",
  "mobiliario-urbano": "/metricas/mobiliario-urbano",
  pluviales: "/metricas/pluviales",
  "vias-peatonales": "/metricas/vias-peatonales",
}

const MODE_COPY: Record<MetricMode, { title: string; description: string }> = {
  current: {
    title: "Estado actual",
    description: "Avisos ingresados en el período y su situación actual",
  },
  flow: {
    title: "Flujo",
    description: "Altas, bajas y stock al cierre del período",
  },
}

export default function MetricVersionSwitch({ activeMode, area }: Props) {
  const currentHref = area === "all" ? "/metricas" : ORIGINAL_ROUTES[area]
  const flowHref =
    area === "all"
      ? "/metricas/flujo-mantenimiento"
      : `/metricas/flujo-mantenimiento?area=${area}`
  const activeCopy = MODE_COPY[activeMode]

  return (
    <section className={styles.switcher} aria-label="Modo de análisis">
      <div className={styles.context}>
        <CompareArrowsRoundedIcon aria-hidden="true" />
        <div>
          <span>Modo de análisis</span>
          <strong>{activeCopy.title}</strong>
          <p>{activeCopy.description}</p>
        </div>
      </div>

      <nav className={styles.options} aria-label="Cambiar modo de análisis">
        <Link
          href={currentHref}
          className={activeMode === "current" ? styles.activeOption : styles.option}
          aria-current={activeMode === "current" ? "page" : undefined}
        >
          <span>
            {activeMode === "current" ? <CheckRoundedIcon aria-hidden="true" /> : null}
            Estado actual
          </span>
          <small>Cohorte de ingresos</small>
        </Link>
        <Link
          href={flowHref}
          className={activeMode === "flow" ? styles.activeOption : styles.option}
          aria-current={activeMode === "flow" ? "page" : undefined}
        >
          <span>
            {activeMode === "flow" ? <CheckRoundedIcon aria-hidden="true" /> : null}
            Flujo
          </span>
          <small>Movimientos y stock</small>
        </Link>
      </nav>
    </section>
  )
}
