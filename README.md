# metricas-tremor

Dashboards de métricas de Alumbrado y Paisaje Urbano. Una ETL diaria filtra el
CSV crudo de Avisos SAP y publica snapshots comprimidos que consume la app.

> La automatización productiva pendiente está especificada paso a paso en
> [AUTOMATIZACION_ETL.md](./AUTOMATIZACION_ETL.md). Ese archivo es el punto de
> entrada para cualquier persona o agente que retome el despliegue.

## Fuente de datos

La aplicación espera un archivo separado por `|`, codificado como
Windows-1252/Latin-1, con 17 columnas y sin encabezado. Las líneas informativas
del inicio se ignoran automáticamente porque no tienen esa cantidad de
columnas.

Los campos utilizados son:

| Índice | Campo |
|---:|---|
| 0 | Aviso |
| 2 | Fecha de ingreso (`yyyyMMdd`) |
| 3 | Hora de ingreso (`HHmmss`) |
| 4 | Estado general |
| 5 | Grupo de planificación |
| 6 | Barrio |
| 12 | Comuna |
| 13 | Prestación |

El estado general se aplica a ambos tableros. `REOK` y `TERC` son resueltos;
`OPER`, `INIC`, `PLAN`, `VERI`, `PROG` y `SERV` son pendientes; `IM01` a
`IM05` y `CANC` son denegados.

Un único recorrido del CSV genera simultáneamente los datasets de Alumbrado y
Paisaje Urbano utilizando las prestaciones y grupos definidos en
`src/lib/metricas-csv.ts`.

Como el CSV crudo no contiene el campo enriquecido `Tipo`, la prestación se
usa como categoría operativa en ambos tableros.

## ETL diaria

La ETL lee automáticamente `.env.local` y se ejecuta con:

```powershell
npm run etl-metricas
```

Genera dentro de `METRICAS_ETL_OUT_DIR`:

- un snapshot `.json.gz` versionado para Alumbrado;
- un snapshot `.json.gz` versionado para Paisaje Urbano;
- `metricas-manifest.json`, con conteos, fechas, tamaños y checksums SHA-256.

Los datasets se escriben antes que el manifest. De este modo, una ejecución
fallida conserva la versión anterior y el consumidor nunca apunta a archivos
incompletos. También se validan umbrales mínimos, configurables mediante
`METRICAS_ETL_MIN_ALUMBRADO_ROWS` y
`METRICAS_ETL_MIN_PAISAJE_URBANO_ROWS`.

## Desarrollo local

Configura la ruta del archivo antes de iniciar la aplicación:

```powershell
$env:METRICAS_CSV_PATH='D:\Descargas\archivo diario.csv'
npm run dev
```

La configuración recomendada usa el CSV como entrada de la ETL y su directorio
de salida como fuente primaria de la aplicación:

```env
METRICAS_CSV_PATH=D:/Descargas/archivo diario.csv
METRICAS_ETL_OUT_DIR=data/metricas-etl
METRICAS_JSON_DIR=C:/ruta/al/proyecto/data/metricas-etl
```

## Fuente remota

La tarea ETL consume la URL descargable del CSV:

```powershell
$env:METRICAS_CSV_URL='https://ejemplo.gob.ar/datos/avisos.csv'
npm run etl-metricas
```

También se admiten enlaces compartidos de archivo de Google Drive. La URL no
debe devolver una página HTML ni requerir una sesión interactiva.

Después se publican el manifest y los `.json.gz` en almacenamiento estático o
un CDN. La aplicación consume esa carpeta con:

```env
METRICAS_JSON_BASE_URL=https://datos.ejemplo.gob.ar/metricas/
```

Si el manifest o un checksum falla, la aplicación conserva el snapshot
persistido anterior. El CSV crudo queda como fallback y no participa de la
carga normal del dashboard.

## Snapshots locales

Para generar snapshots de prueba con las mismas reglas del runtime:

```powershell
$env:METRICAS_CSV_PATH='D:\Descargas\archivo diario.csv'
npm run generate-csv-snapshots
```

Los archivos se escriben en `src/data/metricas-demo` y permanecen ignorados
por Git.

Los snapshots JSON antiguos sin manifest siguen admitidos como compatibilidad
de fallback.
