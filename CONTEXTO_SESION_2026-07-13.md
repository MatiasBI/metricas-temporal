# Contexto de trabajo — 13/07/2026

Este archivo resume la sesión en la que se adaptó `metricas-temporal` a la
nueva descarga CSV, se publicó el resultado en Vercel y se dejó preparada la
continuación para automatizar la actualización diaria.

## Estado actual

- Repositorio: <https://github.com/MatiasBI/metricas-temporal>
- Rama activa: `main`
- Producción: <https://metricas-temporal.vercel.app/metricas>
- Proyecto Vercel: `matiasbis-projects/metricas-temporal`
- Último commit funcional de esta sesión: `11d4d9f` — Publicar snapshot ETL inicial
- La aplicación está desplegada y consume el snapshot del CSV de julio de 2026.
- El repositorio quedó limpio y sincronizado con `origin/main`.

## Nueva fuente analizada

Archivo utilizado durante la sesión:

```text
D:/Descargas/archivo del 7-72026 horario 18HS.Csv
```

Características observadas:

- CSV delimitado por `|`.
- Codificación Latin-1.
- 17 columnas.
- 744.255 filas de datos y 744.258 líneas físicas.
- Tamaño aproximado: 146 MB.
- Contiene muchas entradas ajenas a los dashboards actuales.
- Alumbrado y Paisaje Urbano se obtienen del mismo archivo.
- Para ambos datasets se utiliza el estado general del aviso.
- El estado `TERC` se interpreta como resuelto según las reglas actuales.

## Resultados validados con el CSV nuevo

### Alumbrado

- Total: 229.598
- Resueltos: 167.029
- Pendientes: 8.611
- Denegados: 53.958

### Paisaje Urbano

- Total: 7.008
- Resueltos: 2.127
- Pendientes: 3.332
- Denegados: 1.549

Las APIs de producción devolvieron estos valores y respondieron HTTP 200.

## Comparación con la fuente anterior

Antes del cambio, producción mostraba información de abril de 2026:

- Alumbrado: 104.008 registros.
- Paisaje Urbano: 109 registros.

Los Excel anteriores siguen configurados como fallback. No deben eliminarse
hasta que el flujo diario nuevo esté automatizado y estabilizado.

## Cambios implementados

- `src/lib/metricas-csv.ts`: parser compartido y normalización de reglas.
- `src/lib/metricas.ts`: carga desde manifest y `.json.gz`, validación de
  tamaño/checksum, lectura local/remota y fallbacks.
- `scripts/etl-metricas.ts`: ETL en streaming para filtrar el CSV y generar
  datasets comprimidos.
- `scripts/generate-csv-snapshots.ts`: adaptado a la nueva lógica compartida.
- `AUTOMATIZACION_ETL.md`: diseño y pasos para la automatización futura.
- `public/data/metricas-etl/`: snapshot estático actualmente publicado.
- `public/data/metricas-etl/README.md`: instrucciones para actualizar el
  snapshot estático manualmente.

La ETL genera:

- Un dataset de Alumbrado `.json.gz`.
- Un dataset de Paisaje Urbano `.json.gz`.
- `metricas-manifest.json` con versión, origen, cantidades, nombres de archivo,
  tamaños y checksums SHA-256.

Los comprimidos actuales pesan aproximadamente 2,8 MB en total. La versión
descomprimida de Alumbrado supera los 70 MB, por lo que debe conservarse el
esquema comprimido.

## Arquitectura temporal publicada

```text
CSV local
  -> npm run etl-metricas
  -> data/metricas-etl
  -> copia versionada en public/data/metricas-etl
  -> deployment de Vercel
  -> APIs y dashboards
```

La variable de producción está configurada así:

```env
METRICAS_JSON_BASE_URL=https://metricas-temporal.vercel.app/data/metricas-etl/
```

Esta solución permite ver los datos nuevos sin Blob Store, pero la actualización
es manual y requiere un nuevo commit/deployment. El almacenamiento externo se
dejó para la automatización.

## Configuración local en otra computadora

Después de clonar o actualizar el repositorio:

```powershell
git clone https://github.com/MatiasBI/metricas-temporal.git
Set-Location metricas-temporal
npm install
```

Si el repositorio ya existe:

```powershell
git switch main
git pull origin main
npm install
```

Crear un `.env.local` propio. No copiar rutas absolutas de esta computadora:

```env
METRICAS_CSV_PATH=D:/ruta/al/archivo-diario.csv
METRICAS_CSV_REFRESH_TTL_MS=86400000
METRICAS_ETL_OUT_DIR=data/metricas-etl
METRICAS_JSON_DIR=D:/ruta/absoluta/al/repositorio/data/metricas-etl
```

No copiar ni versionar `VERCEL_OIDC_TOKEN`, tokens de Blob u otros secretos.

Para trabajar con Vercel desde una computadora nueva:

```powershell
npm install -g vercel@latest
vercel login
vercel whoami
vercel link --yes --project metricas-temporal --scope matiasbis-projects
```

`vercel link` debe ejecutarse dentro del repositorio. En `cmd.exe` se cambia de
carpeta con `cd /d RUTA`; `Set-Location` solamente funciona en PowerShell.

## Comandos útiles

Generar la ETL:

```powershell
npm run etl-metricas
```

Validar el proyecto:

```powershell
npm run build
```

Ejecutar localmente:

```powershell
npm run dev
```

Desplegar manualmente a producción:

```powershell
vercel deploy --prod --yes --scope matiasbis-projects
```

## Próximo objetivo: automatización diaria

La tarea siguiente es reemplazar la publicación estática manual por este flujo:

```text
URL del CSV diario
  -> workflow programado
  -> ETL y controles de calidad
  -> almacenamiento externo
  -> publicación de datasets
  -> publicación del manifest al final
  -> aplicación Vercel
```

Orden recomendado:

1. Definir la URL definitiva del CSV y si requiere autenticación.
2. Crear o conectar almacenamiento externo, inicialmente se evaluó Vercel Blob.
3. Guardar credenciales como secretos, nunca en el repositorio.
4. Ejecutar `npm run etl-metricas` una vez al día desde GitHub Actions u otro scheduler.
5. Validar columnas, fecha, tamaño, checksums y umbral mínimo de registros.
6. Subir primero los dos `.json.gz` versionados.
7. Publicar `metricas-manifest.json` al final para hacer el cambio de forma atómica.
8. Mantener el último snapshot válido si la ejecución falla.
9. Agregar alertas y registro de ejecuciones.
10. Retirar los Excel solamente después de estabilizar el flujo nuevo.

La especificación más detallada está en [AUTOMATIZACION_ETL.md](./AUTOMATIZACION_ETL.md).

## Cards de Notion creadas

- [TASK-1915 — Adaptar la aplicación a la nueva fuente de datos](https://app.notion.com/p/39c42c6f819d81e18822fb43fa4b00fd)
  — completada, fecha 13/07/2026.
- [TASK-1916 — Publicar snapshot ETL inicial en Vercel](https://app.notion.com/p/39c42c6f819d818b815ae73a4be9e955)
  — completada, fecha 13/07/2026.
- [TASK-1917 — Automatizar la actualización diaria de métricas](https://app.notion.com/p/39c42c6f819d8151bb7afb79741bd759)
  — pendiente, inicio 14/07/2026 y finalización 15/07/2026.

Las tres cards están asignadas al responsable y sprint actuales y vinculadas a
la tarea principal de tableros en Tremor.

## Decisiones importantes

- No procesar el CSV completo en cada request del dashboard.
- Filtrar previamente mediante ETL y servir snapshots comprimidos.
- Mantener un único parser y una única definición de reglas de negocio.
- Usar nombres versionados y checksums para evitar datos parciales o corruptos.
- Publicar siempre el manifest al final.
- Conservar fallbacks mientras se estabiliza la nueva fuente.
- La solución estática actual es transitoria; no reemplaza la automatización.

## Punto exacto para retomar

Abrir este archivo y `AUTOMATIZACION_ETL.md`. Luego comenzar TASK-1917 por la
definición de la URL diaria del CSV y del almacenamiento externo. No es necesario
rehacer la adaptación, la ETL ni el deployment inicial: ya están implementados,
versionados y verificados en producción.
