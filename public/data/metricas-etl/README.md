# Snapshot ETL publicado

Esta carpeta contiene el snapshot estático que consume temporalmente la
aplicación desplegada en Vercel. Los archivos se generan con:

```powershell
npm run etl-metricas
```

Para actualizar este snapshot manualmente, copie desde `data/metricas-etl`
el `metricas-manifest.json` y los dos archivos `.json.gz` versionados que el
manifest referencia. Publique primero los `.json.gz` y el manifest al final.

La automatización diaria y el almacenamiento remoto definitivo están
documentados en `AUTOMATIZACION_ETL.md`.
