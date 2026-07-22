"use client"

import { Button } from "@tremor/react"
import {
  Box,
  Checkbox,
  Collapse,
  Drawer,
  FormControlLabel,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  type SelectChangeEvent,
} from "@mui/material"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import ChevronRightIcon from "@mui/icons-material/ChevronRight"
import CloseRoundedIcon from "@mui/icons-material/CloseRounded"

import formatComuna from "./components/formatComuna"
import formatPrestacion from "./components/formatPrestacion"

const MONTHS = [
  { value: "01", label: "Enero" },
  { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Mayo" },
  { value: "06", label: "Junio" },
  { value: "07", label: "Julio" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
]

type MetricasData = {
  filtros: {
    prestaciones: string[]
    categorias: string[]
    comunas: string[]
    barrios: string[]
  }
}

type ActiveFilterItem =
  | { key: string; label: string; type: "year"; value: string }
  | { key: string; label: string; type: "month"; value: string }
  | { key: string; label: string; type: "prestacion"; value: string }
  | { key: string; label: string; type: "categoria"; value: string }
  | { key: string; label: string; type: "comuna"; value: string }
  | { key: string; label: string; type: "barrio"; value: string }

type Props = {
  dashboardData: MetricasData
  drawerOpen: boolean
  hasActiveFilter: boolean
  selectedYears: string[]
  selectedMonths: string[]
  expandedYears: string[]
  selectedPrestaciones: string[]
  selectedCategorias: string[]
  selectedComunas: string[]
  selectedBarrios: string[]
  activeFilterItems: ActiveFilterItem[]
  years: string[]
  monthsByYear: Record<string, string[]>
  onClose: () => void
  onClearFilter: () => void
  onRemoveFilter: (item: ActiveFilterItem) => void
  onToggleYearExpansion: (year: string) => void
  onToggleYear: (year: string) => void
  onToggleMonth: (year: string, monthKey: string) => void
  onPrestacionesChange: (event: SelectChangeEvent<string[]>) => void
  onCategoriasChange: (event: SelectChangeEvent<string[]>) => void
  onComunasChange: (event: SelectChangeEvent<string[]>) => void
  onBarriosChange: (event: SelectChangeEvent<string[]>) => void
}

export default function FilterDrawer({
  dashboardData,
  drawerOpen,
  hasActiveFilter,
  selectedYears,
  selectedMonths,
  expandedYears,
  selectedPrestaciones,
  selectedCategorias,
  selectedComunas,
  selectedBarrios,
  activeFilterItems,
  years,
  monthsByYear,
  onClose,
  onClearFilter,
  onRemoveFilter,
  onToggleYearExpansion,
  onToggleYear,
  onToggleMonth,
  onPrestacionesChange,
  onCategoriasChange,
  onComunasChange,
  onBarriosChange,
}: Props) {
  return (
    <Drawer
      anchor="bottom"
      open={drawerOpen}
      onClose={onClose}
      PaperProps={{
        sx: {
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          maxHeight: "88vh",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(245,250,253,0.98) 100%)",
        },
      }}
    >
      <div className="mx-auto w-full max-w-screen-md px-4 py-4 sm:px-6 sm:py-5">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-slate-200" />

        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Filtros</h2>
            <p className="text-sm text-slate-500">Ajusta el periodo y el alcance del tablero.</p>
          </div>
          <Button
            variant="secondary"
            disabled={!hasActiveFilter}
            onClick={onClearFilter}
          >
            Limpiar
          </Button>
        </div>

        {hasActiveFilter ? (
          <Paper
            sx={{
              p: 2,
              borderRadius: 4,
              mb: 2,
              background: "rgba(255,255,255,0.92)",
              border: "1px solid #dbe5ef",
              boxShadow: "0 14px 28px rgba(148, 163, 184, 0.12)",
            }}
          >
            <div className="mb-2 text-sm font-semibold text-slate-700">
              Filtros aplicados
            </div>
            <div className="flex flex-wrap gap-2">
              {activeFilterItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onRemoveFilter(item)}
                  className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800 transition hover:border-sky-300 hover:bg-sky-100"
                >
                  <span>{item.label}</span>
                  <CloseRoundedIcon sx={{ fontSize: 14 }} />
                </button>
              ))}
            </div>
          </Paper>
        ) : null}

        <Paper
          sx={{
            p: 2,
            borderRadius: 4,
            mb: 2,
            background: "rgba(255,255,255,0.92)",
            border: "1px solid #dbe5ef",
            boxShadow: "0 14px 28px rgba(148, 163, 184, 0.12)",
          }}
        >
          <Box sx={{ fontSize: 14, fontWeight: 700, mb: 1.5 }}>Periodo</Box>
          {years.map((year) => {
            const yearMonths = monthsByYear[year] ?? []
            const availableMonths = MONTHS.filter((month) =>
              yearMonths.includes(`${year}-${month.value}`)
            )
            const selectedCount = yearMonths.filter((month) =>
              selectedMonths.includes(month)
            ).length
            const checked =
              selectedYears.includes(year) || selectedCount === yearMonths.length
            const indeterminate =
              !checked &&
              selectedCount > 0 &&
              selectedCount < yearMonths.length
            const expanded = expandedYears.includes(year)

            return (
              <Box
                key={year}
                sx={{
                  border: "1px solid #e5edf4",
                  borderRadius: 3,
                  mb: 1,
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    px: 1,
                    py: 0.5,
                    bgcolor: "#f8fbfd",
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={checked}
                        indeterminate={indeterminate}
                        onChange={() => onToggleYear(year)}
                      />
                    }
                    label={year}
                    sx={{ m: 0 }}
                  />
                  <button
                    type="button"
                    onClick={() => onToggleYearExpansion(year)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:-translate-y-px hover:border-sky-300 hover:text-sky-700 hover:shadow-md"
                  >
                    {expanded ? (
                      <ExpandMoreIcon fontSize="small" />
                    ) : (
                      <ChevronRightIcon fontSize="small" />
                    )}
                  </button>
                </Box>
                <Collapse in={expanded}>
                  <Box
                    sx={{
                      px: 2,
                      py: 1,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    {availableMonths.map((month) => {
                      const monthKey = `${year}-${month.value}`
                      return (
                        <FormControlLabel
                          key={monthKey}
                          control={
                            <Checkbox
                              checked={
                                selectedYears.includes(year) ||
                                selectedMonths.includes(monthKey)
                              }
                              onChange={() => onToggleMonth(year, monthKey)}
                            />
                          }
                          label={month.label}
                          sx={{ ml: 1 }}
                        />
                      )
                    })}
                  </Box>
                </Collapse>
              </Box>
            )
          })}
        </Paper>

        <div className="grid grid-cols-1 gap-3">
          <Paper
            sx={{
              p: 2,
              borderRadius: 4,
              background: "rgba(255,255,255,0.92)",
              border: "1px solid #dbe5ef",
              boxShadow: "0 14px 28px rgba(148, 163, 184, 0.12)",
            }}
          >
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Prestacion
            </label>
            <Select
              fullWidth
              multiple
              size="small"
              displayEmpty
              value={selectedPrestaciones}
              onChange={onPrestacionesChange}
              renderValue={(selected) =>
                selected.length
                  ? selected.map((item) => formatPrestacion(item)).join(", ")
                  : "Todas"
              }
            >
              {dashboardData.filtros.prestaciones.map((prestacion) => (
                <MenuItem key={prestacion} value={prestacion}>
                  <Checkbox checked={selectedPrestaciones.includes(prestacion)} />
                  <ListItemText primary={formatPrestacion(prestacion)} />
                </MenuItem>
              ))}
            </Select>
          </Paper>

          <Paper
            sx={{
              p: 2,
              borderRadius: 4,
              background: "rgba(255,255,255,0.92)",
              border: "1px solid #dbe5ef",
              boxShadow: "0 14px 28px rgba(148, 163, 184, 0.12)",
            }}
          >
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Categoria
            </label>
            <Select
              fullWidth
              multiple
              size="small"
              displayEmpty
              value={selectedCategorias}
              onChange={onCategoriasChange}
              renderValue={(selected) =>
                selected.length ? selected.join(", ") : "Todas"
              }
            >
              {dashboardData.filtros.categorias.map((categoria) => (
                <MenuItem key={categoria} value={categoria}>
                  <Checkbox checked={selectedCategorias.includes(categoria)} />
                  <ListItemText primary={categoria} />
                </MenuItem>
              ))}
            </Select>
          </Paper>

          <Paper
            sx={{
              p: 2,
              borderRadius: 4,
              background: "rgba(255,255,255,0.92)",
              border: "1px solid #dbe5ef",
              boxShadow: "0 14px 28px rgba(148, 163, 184, 0.12)",
            }}
          >
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Comuna
            </label>
            <Select
              fullWidth
              multiple
              size="small"
              displayEmpty
              value={selectedComunas}
              onChange={onComunasChange}
              renderValue={(selected) =>
                selected.length
                  ? selected.map((item) => formatComuna(item)).join(", ")
                  : "Todas"
              }
            >
              {dashboardData.filtros.comunas.map((comuna) => (
                <MenuItem key={comuna} value={comuna}>
                  <Checkbox checked={selectedComunas.includes(comuna)} />
                  <ListItemText primary={formatComuna(comuna)} />
                </MenuItem>
              ))}
            </Select>
          </Paper>

          <Paper
            sx={{
              p: 2,
              borderRadius: 4,
              background: "rgba(255,255,255,0.92)",
              border: "1px solid #dbe5ef",
              boxShadow: "0 14px 28px rgba(148, 163, 184, 0.12)",
            }}
          >
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Barrio
            </label>
            <Select
              fullWidth
              multiple
              size="small"
              displayEmpty
              value={selectedBarrios}
              onChange={onBarriosChange}
              renderValue={(selected) =>
                selected.length ? selected.join(", ") : "Todos"
              }
            >
              {dashboardData.filtros.barrios.map((barrio) => (
                <MenuItem key={barrio} value={barrio}>
                  <Checkbox checked={selectedBarrios.includes(barrio)} />
                  <ListItemText primary={barrio} />
                </MenuItem>
              ))}
            </Select>
          </Paper>
        </div>

        <div className="mt-4">
          <Button className="w-full" onClick={onClose}>
            Ver tablero
          </Button>
        </div>
      </div>
    </Drawer>
  )
}
