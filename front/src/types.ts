// Modelos que comparten el front y el backend.
// Los nombres de campos son una propuesta: si el backend usa otros, se ajustan aquí.

export type Usuario = {
  id: number;
  nombre: string;
  documento: string;
  usuario: string;
  rol: string; // nombre del rol
  activo: boolean;
};

export const MODULOS = [
  "Inspecciones",
  "Novedades e incidentes",
  "Mantenimientos",
  "Seguimiento SST",
  "Documentos",
  "Reportes y tableros",
  "Usuarios y roles",
  "Catálogos y listas",
] as const;
export type Modulo = (typeof MODULOS)[number];

export const NIVELES = ["Sin acceso", "Solo ver", "Ver y gestionar"] as const;
export type Nivel = (typeof NIVELES)[number];

export type Rol = {
  id: number;
  nombre: string;
  base: boolean; // true para Operario, Jefe de Taller, SST y Administrador
  permisos: Record<Modulo, Nivel>;
};

export type TipoEquipo = {
  id: number;
  nombre: string;
  descripcion: string;
  activo: boolean;
};

export const ESTADOS_EQUIPO = ["Disponible", "En mantenimiento", "Fuera de servicio"] as const;
export type EstadoEquipo = (typeof ESTADOS_EQUIPO)[number];

export type Equipo = {
  id: number;
  codigo: string;
  tipo: string; // nombre del tipo de equipo
  marca: string;
  serie: string;
  anio: string;
  horometro: string;
  estado: EstadoEquipo;
  modificado: string; // "usuario · fecha" de la última modificación (lo llena el backend)
};

export type Item = { texto: string };
export type Seccion = { titulo: string; items: Item[] };

export type ListaInspeccion = {
  id: number;
  tipo: string; // tipo de equipo: cada tipo tiene una sola lista
  version: number; // el backend la sube en cada actualización
  secciones: Seccion[];
};

export type Sesion = {
  token: string;
  nombre: string;
  usuario: string;
  rol: string;
};
