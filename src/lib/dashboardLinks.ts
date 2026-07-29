import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined"
import AppsRoundedIcon from "@mui/icons-material/AppsRounded"
import ConstructionOutlinedIcon from "@mui/icons-material/ConstructionOutlined"
import DirectionsWalkOutlinedIcon from "@mui/icons-material/DirectionsWalkOutlined"
import ParkOutlinedIcon from "@mui/icons-material/ParkOutlined"
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined"
import WaterDropOutlinedIcon from "@mui/icons-material/WaterDropOutlined"
import WeekendOutlinedIcon from "@mui/icons-material/WeekendOutlined"
import type { SvgIconComponent } from "@mui/icons-material"

export type DashboardLink = {
  href: string
  title: string
  subtitle: string
  description: string
  Icon: SvgIconComponent
}

export const maintenanceDashboardLinks: DashboardLink[] = [
  {
    href: "/metricas/mantenimiento",
    title: "Todas las áreas",
    subtitle: "Vista consolidada de mantenimiento",
    description:
      "Indicadores consolidados de todas las direcciones generales de mantenimiento.",
    Icon: AppsRoundedIcon,
  },
  {
    href: "/metricas/alumbrado",
    title: "Alumbrado",
    subtitle: "Alumbrado y mantenimiento operativo",
    description:
      "Indicadores principales, distribucion por comunas, pendientes y motivos de baja.",
    Icon: LightbulbOutlinedIcon,
  },
  {
    href: "/metricas/calzada-emui",
    title: "Calzada - EMUI",
    subtitle: "Mantenimiento de calzadas",
    description:
      "Indicadores principales, distribucion territorial, pendientes y motivos de baja.",
    Icon: ConstructionOutlinedIcon,
  },
  {
    href: "/metricas/mobiliario-urbano",
    title: "Mobiliario Urbano",
    subtitle: "Mantenimiento de mobiliario urbano",
    description:
      "Indicadores principales, distribucion territorial, pendientes y motivos de baja.",
    Icon: WeekendOutlinedIcon,
  },
  {
    href: "/metricas/pluviales",
    title: "Pluviales",
    subtitle: "Sistemas pluviales",
    description:
      "Indicadores principales, distribucion territorial, pendientes y motivos de baja.",
    Icon: WaterDropOutlinedIcon,
  },
  {
    href: "/metricas/vias-peatonales",
    title: "Vias Peatonales",
    subtitle: "Mantenimiento de vias peatonales",
    description:
      "Indicadores principales, distribucion territorial, pendientes y motivos de baja.",
    Icon: DirectionsWalkOutlinedIcon,
  },
]

export const paisajeDashboardLinks: DashboardLink[] = [
  {
    href: "/metricas/paisaje-urbano",
    title: "Paisaje Urbano",
    subtitle: "Direccion General de Conservacion de Paisaje Urbano",
    description:
      "Lectura ejecutiva de patrimonio, espacios verdes, mobiliario y estado de resolucion.",
    Icon: ParkOutlinedIcon,
  },
  {
    href: "/metricas/ferias",
    title: "Ferias",
    subtitle: "Seguimiento operativo de ferias",
    description:
      "Indicadores, distribución territorial, pendientes y motivos de baja para FM1.",
    Icon: StorefrontOutlinedIcon,
  },
]

export const dashboardLinks: DashboardLink[] = [
  ...maintenanceDashboardLinks,
  ...paisajeDashboardLinks,
]

export const subsecretariaLinks: DashboardLink[] = [
  {
    href: "/metricas/mantenimiento",
    title: "Subsecretaria de Mantenimiento",
    subtitle: "",
    description:
      "Acceso a los tableros de seguimiento operativo de mantenimiento.",
    Icon: LightbulbOutlinedIcon,
  },
  {
    href: "/metricas/paisaje-urbano",
    title: "Subsecretaria de Paisaje Urbano",
    subtitle: "",
    description:
      "Acceso a los tableros de seguimiento de paisaje urbano y ferias.",
    Icon: ParkOutlinedIcon,
  },
]
