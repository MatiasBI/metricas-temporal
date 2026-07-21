export type RouteGroups = "Administracion" | "Planificacion" | "Obras"

export type RouteDataType = {
  group?: RouteGroups
  authUnprotected?: boolean
  alwaysAllowedMiddleware?: boolean
  routeName?: string
  shortName?: string
  routeDescription?: string
  Icon?: unknown
  subRoutes?: any
}

export const RouteData: Record<string, RouteDataType> = {
  "/": {
    routeName: "Home",
    alwaysAllowedMiddleware: true,
  },

  "/metricas": {
    routeName: "Metricas",
    authUnprotected: true,
    alwaysAllowedMiddleware: true,
  },

  "/metricas/alumbrado": {
    routeName: "Metricas SSMAURB",
    authUnprotected: true,
    alwaysAllowedMiddleware: true,
  },

  "/metricas/calzada-emui": {
    routeName: "Metricas Calzada - EMUI",
    authUnprotected: true,
    alwaysAllowedMiddleware: true,
  },

  "/metricas/mobiliario-urbano": {
    routeName: "Metricas Mobiliario Urbano",
    authUnprotected: true,
    alwaysAllowedMiddleware: true,
  },

  "/metricas/pluviales": {
    routeName: "Metricas Pluviales",
    authUnprotected: true,
    alwaysAllowedMiddleware: true,
  },

  "/metricas/vias-peatonales": {
    routeName: "Metricas Vias Peatonales",
    authUnprotected: true,
    alwaysAllowedMiddleware: true,
  },

  "/metricas/flujo-mantenimiento": {
    routeName: "Flujo Mantenimiento",
    authUnprotected: true,
    alwaysAllowedMiddleware: true,
  },

  "/metricas/paisaje-urbano": {
    routeName: "Metricas Paisaje Urbano",
    authUnprotected: true,
    alwaysAllowedMiddleware: true,
  },

  "/login": {
    authUnprotected: true,
    alwaysAllowedMiddleware: true,
  },

  "/logout": {
    alwaysAllowedMiddleware: true,
  },
}
