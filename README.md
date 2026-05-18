# metricas-tremor-nuevo-csv

Prototipo separado de `metricas-tremor` para alimentar los dashboards desde la
exportacion oficial CSV cruda.

## Fuente de datos

La fuente oficial es el CSV crudo de avisos, separado por `|` y sin encabezado.
La fuente actual esta publicada en Google Drive:

```powershell
https://drive.google.com/file/d/1g79QibOjXryN2Nra0_n8x-qPpW3mSUM1/view?usp=sharing
```

Mas adelante, el mismo generador puede consumir un link diario actualizado usando
`METRICAS_CSV_URL`.

## Datos en runtime

La aplicacion puede construir los datos desde una URL configurada en runtime:

```powershell
$env:METRICAS_CSV_URL='https://drive.google.com/file/d/1g79QibOjXryN2Nra0_n8x-qPpW3mSUM1/view?usp=sharing'
npm run dev
```

La URL puede ser un link compartido de Google Drive o un link directo al CSV.
Si el link abre una pagina intermedia no soportada, como una landing de
FromSmash, hay que reemplazarlo por el link directo al archivo.

Para desarrollo local tambien puede usarse:

```powershell
$env:METRICAS_CSV_PATH='C:\ruta\al\archivo-crudo.csv'
npm run dev
```

Los datos procesados se cachean en `.next/cache` y no se versionan en Git.

Tambien se puede apuntar la aplicacion a snapshots JSON ya normalizados,
generados por el transformador de Avisos SAP:

```powershell
$env:METRICAS_JSON_DIR='C:\ruta\a\metricas-json'
npm run dev
```

La carpeta debe contener:

```text
metricas-alumbrado-dataset.json
metricas-paisaje-urbano-dataset.json
```

Cuando `METRICAS_JSON_DIR` esta configurado, esos JSON tienen prioridad sobre
el cache local y evitan parsear el CSV crudo en runtime.

Para produccion, los mismos archivos pueden publicarse por URL usando
`METRICAS_JSON_BASE_URL`:

```powershell
$env:METRICAS_JSON_BASE_URL='https://drive.google.com/drive/folders/1T-s0u1iASp--kZyaFXR7xIykaOp5UC6q?usp=sharing'
npm run dev
```

Si la URL es una carpeta publica de Google Drive, la app busca dentro de esa
carpeta los archivos `metricas-alumbrado-dataset.json` y
`metricas-paisaje-urbano-dataset.json` por nombre.

## Snapshots locales

Si hace falta generar snapshots locales para pruebas:

```powershell
npm run generate-csv-snapshots
```

Los archivos generados en `src/data/metricas-demo/*.json` quedan ignorados por
Git para evitar subir datasets completos al repositorio.

## Criterio de Alumbrado

Un aviso entra en Alumbrado cuando cumple alguno de estos criterios:

- `Grupo planificacion` empieza con `AL`, excluyendo `ALU` y `ALD`.
- La prestacion pertenece al set historico de 8 prestaciones de alumbrado.

`Status de usuario` se guarda como motivo de baja para registros denegados.
