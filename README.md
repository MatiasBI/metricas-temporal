# metricas-tremor

Dashboards de metricas alimentados por los archivos operativos de Alumbrado y
Paisaje Urbano.

## Fuente de datos

La fuente local primaria son los libros Excel binarios entregados por cada area:

- Alumbrado: `SSMAN ABRIL-26 (1) ENRIQUECIDO.xlsb`
- Paisaje Urbano: `SSPURB ABRIL-26 ENRIQUECIDO.xlsb`

El dashboard lee la hoja `TOTAL` de cada libro, normaliza `StatUsu` con la regla
actual de estados, usa `Barrio` y `Hora de ingreso` cuando estan presentes y
conserva los filtros de prestaciones configurados para cada tablero.

## Datos en runtime

Por defecto, en desarrollo local se buscan estos archivos:

```powershell
C:\Users\Usuario\Downloads\SSMAN ABRIL-26 (1) ENRIQUECIDO.xlsb
C:\Users\Usuario\Downloads\SSPURB ABRIL-26 ENRIQUECIDO.xlsb
```

Se pueden mover configurando las rutas antes de iniciar la aplicacion:

```powershell
$env:METRICAS_ALUMBRADO_XLSB_PATH='C:\ruta\SSMAN ABRIL-26 ENRIQUECIDO.xlsb'
$env:METRICAS_PAISAJE_URBANO_XLSB_PATH='C:\ruta\SSPURB ABRIL-26 ENRIQUECIDO.xlsb'
npm run dev
```

Para Vercel o cualquier entorno sin acceso a esos paths locales, los XLSB
pueden venir desde links descargables:

```powershell
$env:METRICAS_ALUMBRADO_XLSB_URL='https://drive.google.com/file/d/.../view?usp=sharing'
$env:METRICAS_PAISAJE_URBANO_XLSB_URL='https://drive.google.com/file/d/.../view?usp=sharing'
npm run dev
```

Los links compartidos de Google Drive se convierten al flujo de descarga antes
de parsear el libro.

Los snapshots JSON configurados por `METRICAS_JSON_DIR` o
`METRICAS_JSON_BASE_URL` tienen prioridad sobre los XLSB. Si falta un XLSB, la
aplicacion conserva el fallback al CSV crudo de avisos.

Para usar el fallback CSV desde una URL:

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

Un aviso entra en Alumbrado cuando cumple estos criterios:

- `Grupo planificacion` empieza con `AL`, excluyendo `ALU` y `ALD`.
- La prestacion pertenece al set historico de 8 prestaciones de alumbrado.

`Status de usuario` se guarda como motivo de baja para registros denegados.
