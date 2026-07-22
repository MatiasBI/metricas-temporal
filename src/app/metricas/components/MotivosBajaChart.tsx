interface Item {
  motivo: string
  cantidad: number
  porcentaje: number
}

const fmt = (n: number) => n.toLocaleString("es-AR")

export default function MotivosBajaChart({
  items,
  description = "Principales razones de cierre denegado.",
}: {
  items: Item[]
  description?: string
}) {
  const max = Math.max(...items.map((item) => item.cantidad), 1)

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Cierres observados
        </p>
        <h3 className="text-base font-semibold text-slate-800 sm:text-lg">
          Motivos de bajas
        </h3>
        <p className="text-xs text-slate-500 sm:text-sm">
          {description}
        </p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.motivo}>
            <div className="relative h-10 overflow-hidden rounded-full border border-[#dbe5ef] bg-[#f4f8fb]">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#8fd7f8_0%,#00b9f1_100%)]"
                style={{ width: `${(item.cantidad / max) * 100}%` }}
              />
              <div className="relative z-10 flex h-full items-center justify-between px-4">
                <span className="text-[11px] font-medium text-slate-700 sm:text-xs">
                  {item.motivo}
                </span>
                <span className="text-[11px] font-semibold text-slate-700 sm:text-xs">
                  {fmt(item.cantidad)} ({item.porcentaje}%)
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
