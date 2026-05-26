import type { Metadata } from "next"
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined"

import DashboardSelector from "./DashboardSelector"
import { subsecretariaLinks } from "../../lib/dashboardLinks"
import styles from "./metricas-home.module.css"

export const metadata: Metadata = {
  title: "Metricas",
  description: "Accesos a tableros ejecutivos de mantenimiento",
}

export default function MetricasPage() {
  return (
    <main className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.content}>
          <header className={styles.header}>
            <div>
              <p className={styles.brand}>Centro de control</p>
              <h2 className={styles.title}>Ministerio de Espacio Publico</h2>
              <p className={styles.lead}>
                Tableros ejecutivos por subsecretaria.
              </p>
            </div>

            <div className={styles.summaryCard}>
              <div className={styles.summaryIconWrap}>
                <InsightsOutlinedIcon className={styles.summaryIcon} />
              </div>
              <div>
                <p className={styles.summaryEyebrow}>Centro de monitoreo</p>
                <p className={styles.summaryText}>
                  Tableros priorizados para presentacion ejecutiva y lectura rapida.
                </p>
              </div>
            </div>
          </header>

          <DashboardSelector
            links={subsecretariaLinks}
            eyebrow="Subsecretarias"
            title="Seguimiento estrategico"
            description="Selecciona una subsecretaria para abrir sus tableros disponibles."
          />
        </div>
      </div>
    </main>
  )
}
