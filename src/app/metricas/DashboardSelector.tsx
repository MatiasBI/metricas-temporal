"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { dashboardLinks, type DashboardLink } from "../../lib/dashboardLinks"

import styles from "./DashboardSelector.module.css"

type Props = {
  compact?: boolean
  links?: DashboardLink[]
  eyebrow?: string
  title?: string
  description?: string
}

export default function DashboardSelector({
  compact = false,
  links = dashboardLinks,
  eyebrow = "Tableros Ejecutivos",
  title = "Seguimiento estrategico",
  description = "Selecciona uno de los accesos para abrir el dashboard correspondiente.",
}: Props) {
  const pathname = usePathname()

  return (
    <section
      className={`${styles.panel} ${compact ? styles.panelCompact : ""}`.trim()}
    >
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.panelEyebrow}>{eyebrow}</p>
          <h2 className={styles.panelTitle}>{title}</h2>
        </div>
        <p className={styles.panelDescription}>{description}</p>
      </div>

      <div className={styles.buttonGrid}>
        {links.map(({ href, title, subtitle, Icon }) => {
          const isActive = pathname === href

          return (
            <Link
              key={href}
              href={href}
              className={`${styles.quickAccess} ${
                isActive ? styles.quickAccessActive : ""
              }`.trim()}
            >
              <span className={styles.quickIcon}>
                <Icon fontSize="inherit" />
              </span>
              <span className={styles.quickLabel}>{title}</span>
              {subtitle ? (
                <span className={styles.quickSubtitle}>{subtitle}</span>
              ) : null}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
