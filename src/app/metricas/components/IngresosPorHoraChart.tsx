interface Item {
  hora: string
  cantidad: number
  porcentaje: number
  top_prestaciones?: Array<{
    prestacion: string
    cantidad: number
    porcentaje: number
  }>
}

const fmt = (n: number) => n.toLocaleString("es-AR")

export default function IngresosPorHoraChart({
  items,
}: {
  items: Item[]
}) {
  const max = Math.max(...items.map((item) => item.cantidad), 1)

  return (
    <div id="ingresos-por-hora" className="space-y-4 scroll-mt-6">
      <div>
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Pulso operativo
        </p>
        <h3 className="text-base font-semibold text-slate-800 sm:text-lg">
          Ingresos por hora
        </h3>
        <p className="text-xs text-slate-500 sm:text-sm">
          Distribucion de ingresos por franja horaria en la demo.
        </p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.hora}
            className="rounded-2xl border border-[#dbe5ef] bg-white/70 p-2.5 shadow-[0_8px_18px_rgba(15,23,42,0.04)] sm:p-3"
          >
            <div className="grid gap-3 lg:grid-cols-[minmax(320px,1.15fr)_minmax(420px,1fr)] lg:items-center">
              <div className="relative h-10 overflow-hidden rounded-full bg-[#f4f8fb] sm:h-11">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#e0f6e8_0%,#5bc58a_100%)]"
                  style={{ width: `${(item.cantidad / max) * 100}%` }}
                />
                <div className="relative z-10 flex h-full items-center justify-between px-4">
                  <span className="text-[11px] font-medium text-slate-700 sm:text-xs">
                    {item.hora}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-700 sm:text-xs">
                    {fmt(item.cantidad)} ({item.porcentaje}%)
                  </span>
                </div>
              </div>

              <div className="grid gap-2 rounded-xl bg-slate-50/90 px-3 py-2 sm:grid-cols-2">
                {(item.top_prestaciones ?? []).length ? (
                  item.top_prestaciones?.map((prestacion, index) => (
                    <div
                      key={`${item.hora}-${prestacion.prestacion}`}
                      className="min-w-0"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-bold text-emerald-600 ring-1 ring-emerald-100">
                          {index + 1}
                        </span>
                        <span className="truncate text-[11px] font-semibold text-slate-700">
                          {prestacion.prestacion}
                        </span>
                      </div>
                      <p className="ml-5 mt-0.5 text-[10px] font-medium text-slate-500">
                        {fmt(prestacion.cantidad)} reclamos · {prestacion.porcentaje}%
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] font-medium text-slate-400">
                    Sin prestaciones asociadas
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
