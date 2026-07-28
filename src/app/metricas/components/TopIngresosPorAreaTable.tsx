import formatPrestacion from "./formatPrestacion"

type Item = {
  area: string
  prestacion: string
  cantidad: number
}

export default function TopIngresosPorAreaTable({ items }: { items: Item[] }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Comparativa por área
        </p>
        <h3 className="text-base font-semibold text-slate-800 sm:text-lg">
          Prestación con más ingresos de cada área
        </h3>
        <p className="text-xs text-slate-500 sm:text-sm">
          Principal prestación dentro de los filtros seleccionados.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full border-collapse text-left">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Nombre de la prestación
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Nombre del área
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Cantidad de ingresos
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {items.map((item) => (
              <tr key={item.area}>
                <td className="px-4 py-3 text-sm font-medium text-slate-700">
                  {formatPrestacion(item.prestacion)}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{item.area}</td>
                <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-slate-800">
                  {item.cantidad.toLocaleString("es-AR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
