# Automatización pendiente de la ETL de métricas

> Estado: **diseñada y documentada, todavía no activada en producción**.
>
> Este documento es el handoff para cualquier persona o agente que retome la
> automatización desde otra computadora. Leerlo completo antes de modificar la
> ETL, el almacenamiento o la configuración de Vercel.

## Objetivo

Ejecutar automáticamente una vez al día la ETL del CSV de Avisos SAP, publicar
los siete snapshots comprimidos y actualizar el manifest solamente cuando toda
la operación haya terminado correctamente.

El usuario no debería tener que ejecutar manualmente:

```powershell
npm run etl-metricas
```

## Estado actual confirmado

Ya está implementado y probado:

- `scripts/etl-metricas.ts` procesa el CSV por streaming.
- `src/lib/metricas-csv.ts` concentra las reglas de filtrado y normalización.
- Un único CSV genera Alumbrado, Calzada - EMUI, Mobiliario Urbano, Pluviales,
  Vias Peatonales y Paisaje Urbano.
- La ETL genera snapshots `.json.gz` versionados.
- La ETL genera también el agregado mensual de flujo para las cinco áreas de
  Mantenimiento.
- La ETL genera `metricas-manifest.json` con conteos, fechas, tamaños y
  checksums SHA-256.
- Los datasets se escriben antes que el manifest.
- Si la ETL falla, no reemplaza el manifest anterior.
- El runtime acepta `METRICAS_JSON_DIR` para archivos locales.
- El runtime acepta `METRICAS_JSON_BASE_URL` para archivos publicados.
- El runtime valida tamaño y checksum antes de usar un snapshot comprimido.
- El CSV crudo permanece como fallback.

Validación realizada con el archivo del 15/7/2026:

| Dataset | Filas | Tamaño gzip | Primera respuesta local |
|---|---:|---:|---:|
| Alumbrado | 230.355 | 2,56 MB | 1,06 s |
| Calzada - EMUI | 180.825 | 2,12 MB | 1,99 s |
| Mobiliario Urbano | 10.444 | 0,14 MB | 0,80 s |
| Pluviales | 37.004 | 0,46 MB | 0,45 s |
| Vias Peatonales | 176.525 | 2,20 MB | 2,57 s |
| Paisaje Urbano | 7.006 | 0,11 MB | 0,13 s |
| Flujo Mantenimiento | 453.621 filas fuente | 0,05 MB | 0,13 s |

La ETL completa tardó aproximadamente 111 segundos. No debe ejecutarse durante
una petición normal del dashboard.

## Lo que todavía falta implementar

1. Obtener la URL descargable definitiva del CSV diario.
2. Decidir si los snapshots pueden almacenarse públicamente.
3. Crear un Blob Store u otro almacenamiento de objetos.
4. Crear los secretos en GitHub.
5. Crear y activar `.github/workflows/etl-metricas.yml` usando la plantilla de
   este documento.
6. Ejecutar el workflow manualmente por primera vez.
7. Configurar `METRICAS_JSON_BASE_URL` en Vercel.
8. Validar los endpoints desplegados.
9. Activar definitivamente el cron diario.
10. Definir retención y limpieza de versiones antiguas.

## Arquitectura recomendada

```text
URL del CSV diario
        |
        v
GitHub Actions (cron + ejecución manual)
        |
        v
npm run etl-metricas
        |
        +--> metricas-alumbrado-dataset.<version>.<hash>.json.gz
        +--> metricas-calzada-emui-dataset.<version>.<hash>.json.gz
        +--> metricas-mobiliario-urbano-dataset.<version>.<hash>.json.gz
        +--> metricas-pluviales-dataset.<version>.<hash>.json.gz
        +--> metricas-vias-peatonales-dataset.<version>.<hash>.json.gz
        +--> metricas-paisaje-urbano-dataset.<version>.<hash>.json.gz
        +--> metricas-manifest.json
                          |
                          v
               Vercel Blob / S3 / R2
                          |
                          v
                 Aplicación en Vercel
```

Recomendación inicial: **GitHub Actions + Vercel Blob público**, siempre que
una revisión de seguridad confirme que los identificadores de aviso y los
campos exportables pueden ser públicos.

Si los datos no pueden ser públicos, no activar esta propuesta sin adaptar el
runtime para acceder a un Blob privado mediante credenciales del servidor.

## Requisitos externos

### URL del CSV

Debe ser una URL descargable directa que:

- no requiera una sesión interactiva;
- no devuelva una landing HTML;
- permita descargar aproximadamente 146 MB;
- entregue cada día el snapshot histórico completo;
- idealmente informe `ETag` o `Last-Modified`.

### Vercel Blob

Crear un Blob Store conectado al proyecto. Para la implementación planteada,
el store debe ser público porque el runtime actual descarga los archivos por
URL sin encabezado de autenticación.

Documentación oficial:

- https://vercel.com/docs/vercel-blob
- https://vercel.com/docs/cli/blob

### Secretos de GitHub

Crear en `Settings > Secrets and variables > Actions`:

| Secreto | Contenido |
|---|---|
| `METRICAS_CSV_URL` | URL descargable del CSV diario |
| `BLOB_READ_WRITE_TOKEN` | Token de escritura del Blob Store |

No guardar ninguno de estos valores en el repositorio, logs, README o
manifest.

## Workflow propuesto

Cuando estén disponibles el Blob Store y los secretos, crear
`.github/workflows/etl-metricas.yml` con una versión revisada del siguiente
contenido:

```yaml
name: ETL diaria de metricas

on:
  workflow_dispatch:
  schedule:
    # 22:30 UTC = 19:30 America/Buenos_Aires.
    - cron: "30 22 * * *"

concurrency:
  group: etl-metricas-production
  cancel-in-progress: false

permissions:
  contents: read

jobs:
  etl:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    env:
      METRICAS_CSV_URL: ${{ secrets.METRICAS_CSV_URL }}
      METRICAS_ETL_OUT_DIR: data/metricas-etl
      BLOB_READ_WRITE_TOKEN: ${{ secrets.BLOB_READ_WRITE_TOKEN }}

    steps:
      - name: Descargar el repositorio
        uses: actions/checkout@v4

      - name: Configurar Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Instalar dependencias
        run: npm ci

      - name: Ejecutar y validar ETL
        run: npm run etl-metricas

      - name: Validar artefactos esperados
        shell: bash
        run: |
          test -f data/metricas-etl/metricas-manifest.json
          test "$(find data/metricas-etl -name '*.json.gz' | wc -l)" -eq 7

      - name: Publicar datasets versionados
        shell: bash
        run: |
          for file in data/metricas-etl/*.json.gz; do
            npx vercel@latest blob put "$file" \
              --pathname "metricas/$(basename "$file")" \
              --cache-control-max-age 31536000
          done

      - name: Publicar manifest al final
        shell: bash
        run: |
          npx vercel@latest blob put \
            data/metricas-etl/metricas-manifest.json \
            --pathname metricas/metricas-manifest.json \
            --content-type application/json \
            --cache-control-max-age 60 \
            --allow-overwrite
```

### Revisión obligatoria antes de activar el workflow

- Fijar una versión concreta del CLI de Vercel en lugar de `@latest` para
  evitar cambios inesperados.
- Confirmar que el CLI acepta `BLOB_READ_WRITE_TOKEN` en GitHub Actions.
- Confirmar los nombres de los flags contra la documentación vigente.
- Verificar que la URL del CSV es accesible desde un runner de GitHub.
- Confirmar que 19:30 es posterior a la publicación diaria del archivo.
- Considerar que el cron de GitHub usa UTC y puede comenzar con algunos
  minutos de demora.

Documentación del cron de GitHub Actions:

- https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax

## Orden de publicación: no modificar

El workflow debe publicar en este orden:

1. Los siete snapshots versionados.
2. Manifest estable, **siempre al final**.

Los nombres de los datasets incluyen versión y hash, por lo que son
inmutables. El manifest es el único puntero mutable. Si una carga falla antes
del paso 3, la aplicación continúa leyendo la versión anterior.

Nunca sobrescribir el manifest antes de confirmar que los siete archivos que
referencia existen y son descargables.

## Configuración de Vercel

Después de la primera publicación exitosa, obtener la URL base del directorio
`metricas/` y configurar en Production:

```env
METRICAS_JSON_BASE_URL=https://<store-publico>.public.blob.vercel-storage.com/metricas/
```

Mantener temporalmente `METRICAS_CSV_URL` como fallback. El runtime prioriza el
manifest ETL cuando `METRICAS_JSON_BASE_URL` está configurada.

Después de cambiar variables de entorno, volver a desplegar la aplicación.

## Primera activación

No habilitar el cron y asumir que funciona. Seguir este orden:

1. Crear el workflow con `workflow_dispatch` y comentar temporalmente
   `schedule` si se desea.
2. Ejecutarlo manualmente desde la pestaña Actions.
3. Confirmar que finaliza en verde.
4. Revisar que Blob contiene siete `.json.gz` y el manifest.
5. Descargar el manifest y verificar que sus nombres coinciden con los blobs.
6. Configurar `METRICAS_JSON_BASE_URL` en Vercel.
7. Desplegar.
8. Consultar:
   - `/api/metricas`
   - `/api/calzada-emui`
   - `/api/mobiliario-urbano`
   - `/api/pluviales`
   - `/api/vias-peatonales`
   - `/api/paisaje-urbano`
9. Confirmar los conteos del manifest y de los siete endpoints.
10. Medir tiempos de primera respuesta.
11. Recién entonces activar el cron diario.

## Criterios de aceptación

La automatización se considera terminada cuando:

- corre diariamente sin intervención humana;
- también puede ejecutarse con `workflow_dispatch`;
- una falla no reemplaza el manifest anterior;
- los seis datasets superan sus umbrales mínimos;
- los checksums descargados coinciden;
- el manifest informa una fecha de datos reciente;
- los endpoints entregan los mismos conteos del manifest;
- la primera respuesta de Alumbrado permanece en pocos segundos;
- GitHub notifica una ejecución fallida;
- existe un procedimiento probado de rollback.

## Guardas adicionales recomendadas

Antes de activar producción, mejorar `scripts/etl-metricas.ts` para fallar si:

- `maxDate` tiene una antigüedad mayor a la tolerada;
- el CSV remoto no cambió durante una cantidad anormal de días;
- el total de filas cae o crece más de un porcentaje configurable respecto de
  la versión anterior;
- falta alguna de las 8 prestaciones de Alumbrado;
- algún área por GP cae por debajo de su umbral esperado;
- falta alguna de las 25 prestaciones de Paisaje Urbano.

Estas guardas evitan publicar silenciosamente un archivo diario incompleto.

## Retención y limpieza

La ETL usa nombres versionados, por lo que Blob acumulará archivos. No borrar la
versión actualmente referenciada por el manifest.

Política sugerida:

- conservar los últimos 7 días;
- conservar una versión semanal durante 8 semanas;
- eliminar el resto después de publicar y verificar el manifest nuevo.

La limpieza debe implementarse como un job separado o como último paso no
bloqueante. Una falla de limpieza no debe invalidar una ETL correcta.

## Rollback

Para volver a una versión anterior:

1. Identificar los siete snapshots de la misma ejecución anterior.
2. Recuperar o reconstruir el manifest que los referencia.
3. Validar tamaños y SHA-256.
4. Sobrescribir únicamente `metricas/metricas-manifest.json`.
5. Consultar los siete endpoints y verificar los conteos.

No es necesario redeployar la aplicación si solo cambia el manifest.

## Alternativa cuando la URL es privada o interna

Si el CSV solamente es accesible desde una VPN o una red del Gobierno, GitHub
Actions no podrá descargarlo. En ese caso usar:

- Programador de tareas de Windows en una PC o VM siempre encendida; o
- un runner self-hosted de GitHub dentro de la red autorizada.

El comando programado sigue siendo:

```powershell
Set-Location C:\ruta\al\repositorio
npm ci
npm run etl-metricas
```

Después debe ejecutar el mismo bloque de publicación a Blob y registrar logs.

## Archivos relevantes

- `scripts/etl-metricas.ts`: ETL productiva.
- `src/lib/metricas-csv.ts`: reglas de negocio del CSV.
- `src/lib/metricas.ts`: carga de manifest, gzip, checksum y fallbacks.
- `README.md`: configuración general.
- `vercel.json`: configuración actual de hosting.
- `.env.local`: configuración local ignorada por Git; nunca copiar secretos.

## Nota para el próximo agente

No reimplementar el filtrado en el workflow. El workflow debe invocar
`npm run etl-metricas`; las reglas viven en `src/lib/metricas-csv.ts`.

Antes de crear recursos o secretos externos, confirmar con el usuario:

1. URL definitiva y mecanismo de autenticación del CSV.
2. Si los snapshots pueden ser públicos.
3. Cuenta/equipo de Vercel que alojará Blob.
4. Hora real de actualización diaria.
5. Política de retención requerida.

