import { promises as fs } from "fs"
import path from "path"

import { getMetricasData } from "../src/lib/metricas"
import {
  METRICAS_DATASET_KEYS,
  type MetricasDatasetKey,
} from "../src/lib/metricas-csv"

async function waitForCacheSnapshot(cachePath: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const stats = await fs.stat(cachePath)

      if (stats.size > 0) {
        return
      }
    } catch {
      // Keep polling until the cache file is persisted.
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`El snapshot cacheado no estuvo listo a tiempo: ${cachePath}`)
}

async function ensureDemoSnapshot(datasetKey: MetricasDatasetKey) {
  const cachePath = path.join(
    process.cwd(),
    ".next",
    "cache",
    `metricas-${datasetKey}-dataset.json`
  )

  await fs.rm(cachePath, { force: true })
  await getMetricasData(datasetKey)
  const demoDir = path.join(process.cwd(), "src", "data", "metricas-demo")
  const demoPath = path.join(demoDir, `${datasetKey}-dataset.json`)

  await waitForCacheSnapshot(cachePath)
  await fs.mkdir(demoDir, { recursive: true })
  await fs.copyFile(cachePath, demoPath)

  console.log(`Demo snapshot generado: ${demoPath}`)
}

async function main() {
  for (const datasetKey of METRICAS_DATASET_KEYS) {
    console.log(`Preparando snapshot demo para ${datasetKey}...`)
    await ensureDemoSnapshot(datasetKey)
  }
}

main().catch((error) => {
  console.error("No se pudieron generar los snapshots demo")
  console.error(error)
  process.exit(1)
})
