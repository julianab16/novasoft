// Capa de servicios: TODA la comunicación con el backend pasa por aquí.
// Las vistas solo llaman a `api.*`, nunca a fetch directamente.
//
// - Si VITE_API_URL está vacío, se usan datos de prueba en memoria (mockApi.ts).
// - Si tiene una URL, se hacen peticiones HTTP al backend Django (ver back/README.md).
//   El backend usa nombres en inglés (full_name, identifier…); aquí se traducen
//   a los nombres del front (nombre, codigo…) en ambos sentidos, incluidos los errores.

import { MODULOS, type Equipo, type EstadoEquipo, type ListaInspeccion, type Modulo, type Nivel, type Rol, type Sesion, type TipoEquipo, type Usuario, type UsuarioCreado } from "../types";
import { ApiError } from "./ApiError";
import { mockApi } from "./mockApi";

export { ApiError };

export type Api = {
  auth: {
    login(usuario: string, clave: string): Promise<Sesion>;
    logout(): Promise<void>;
    cambiarClave(actual: string, nueva: string): Promise<void>;
  };
  usuarios: {
    listar(): Promise<Usuario[]>;
    crear(datos: Omit<Usuario, "id">): Promise<UsuarioCreado>;
    actualizar(id: number, datos: Partial<Usuario>): Promise<Usuario>;
    /** Devuelve la contraseña temporal generada. */
    restablecerClave(id: number): Promise<string>;
  };
  roles: {
    listar(): Promise<Rol[]>;
    crear(nombre: string, soloConsulta: boolean): Promise<Rol>;
    guardarPermisos(id: number, permisos: Record<Modulo, Nivel>): Promise<Rol>;
  };
  tipos: {
    listar(): Promise<TipoEquipo[]>;
    crear(datos: Omit<TipoEquipo, "id">): Promise<TipoEquipo>;
    actualizar(id: number, datos: Partial<TipoEquipo>): Promise<TipoEquipo>;
    eliminar(id: number): Promise<void>;
  };
  equipos: {
    listar(): Promise<Equipo[]>;
    crear(datos: Omit<Equipo, "id" | "modificado">): Promise<Equipo>;
    actualizar(id: string, datos: Partial<Equipo>): Promise<Equipo>;
  };
  listas: {
    listar(): Promise<ListaInspeccion[]>;
    crear(tipo: string): Promise<ListaInspeccion>;
    actualizar(id: string, datos: Pick<ListaInspeccion, "secciones">): Promise<ListaInspeccion>;
  };
};

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "");
export const usaDatosDePrueba = !API_URL;

// ---------------------------------------------------------------------------
// Formato del backend
// ---------------------------------------------------------------------------

type NivelApi = "none" | "view" | "manage";
type UsuarioApi = { id: number; username: string; full_name: string; document: string; role: string; role_name: string; is_active: boolean; temporary_password?: string };
type SesionApi = { access: string; refresh: string; user: { username: string; full_name: string; role_name: string; is_admin: boolean; must_change_password: boolean } };
type RolApi = { id: number; code: string; name: string; is_base: boolean; permissions: Record<string, NivelApi> };
type TipoApi = { id: number; name: string; description: string; is_active: boolean };
type EquipoApi = { identifier: string; plate: string; equipment_type: number; equipment_type_name: string; status: string; model: string; serial_number: string; year: number | null; hour_meter: string; last_modified_by: string | null; last_modified_at: string | null };
type ListaApi = { identifier: string; name: string; version: number; equipment_types_detail: { id: number; name: string }[]; sections: { title: string; items: { text: string; is_critical: boolean }[] }[] };

const MODULO_API: Record<Modulo, string> = {
  Inspecciones: "inspections",
  "Novedades e incidentes": "incidents",
  Mantenimientos: "maintenance",
  "Seguimiento SST": "sst",
  Documentos: "documents",
  "Reportes y tableros": "reports",
  "Usuarios y roles": "users",
  "Catálogos y listas": "catalogs",
};
const NIVEL_API: Record<Nivel, NivelApi> = { "Sin acceso": "none", "Solo ver": "view", "Ver y gestionar": "manage" };
const NIVEL_FRONT = Object.fromEntries(Object.entries(NIVEL_API).map(([k, v]) => [v, k])) as Record<NivelApi, Nivel>;
const ESTADO_API: Record<EstadoEquipo, string> = { Disponible: "usable", "En mantenimiento": "en_mantenimiento", "Fuera de servicio": "no_usable" };
const ESTADO_FRONT = Object.fromEntries(Object.entries(ESTADO_API).map(([k, v]) => [v, k])) as Record<string, EstadoEquipo>;

// Nombre del campo en el backend → nombre en el front (para los errores por campo)
type Campos = Record<string, string>;
const CAMPOS_USUARIO: Campos = { full_name: "nombre", document: "documento", username: "usuario", role: "rol", is_active: "activo", password: "clave" };
const CAMPOS_ROL: Campos = { name: "nombre" };
const CAMPOS_TIPO: Campos = { name: "nombre", description: "descripcion", is_active: "activo" };
const CAMPOS_EQUIPO: Campos = { identifier: "codigo", plate: "placa", equipment_type: "tipo", model: "marca", serial_number: "serie", year: "anio", hour_meter: "horometro", status: "estado" };
const CAMPOS_LISTA: Campos = { equipment_types: "tipo", sections: "secciones", name: "nombre" };
const CAMPOS_CLAVE: Campos = { current_password: "actual", new_password: "nueva" };

/** Traduce un objeto con nombres del front a nombres del backend, solo con las claves presentes. */
function traducir<T extends object>(datos: T, campos: Campos, convertir: Partial<Record<string, (v: never) => unknown>> = {}) {
  const inverso = Object.fromEntries(Object.entries(campos).map(([api, front]) => [front, api]));
  const salida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(datos)) {
    if (!(k in inverso) || v === undefined) continue;
    salida[inverso[k]] = convertir[k] ? convertir[k]!(v as never) : v;
  }
  return salida;
}

const aUsuario = (u: UsuarioApi): Usuario => ({ id: u.id, nombre: u.full_name || u.username, documento: u.document, usuario: u.username, rol: u.role_name, activo: u.is_active });
const aRol = (r: RolApi): Rol => ({ id: r.id, nombre: r.name, base: r.is_base, permisos: Object.fromEntries(MODULOS.map((m) => [m, NIVEL_FRONT[r.permissions[MODULO_API[m]]] ?? "Sin acceso"])) as Record<Modulo, Nivel> });
const aTipo = (t: TipoApi): TipoEquipo => ({ id: t.id, nombre: t.name, descripcion: t.description, activo: t.is_active });
const fecha = (iso: string) => new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
const aEquipo = (e: EquipoApi): Equipo => ({
  id: e.identifier,
  codigo: e.identifier,
  placa: e.plate,
  tipo: e.equipment_type_name,
  marca: e.model,
  serie: e.serial_number,
  anio: e.year ? String(e.year) : "",
  horometro: e.hour_meter,
  estado: ESTADO_FRONT[e.status] ?? "Disponible",
  modificado: e.last_modified_at ? `${e.last_modified_by || "Sistema"} · ${fecha(e.last_modified_at)}` : "Sin cambios registrados",
});
const aLista = (l: ListaApi): ListaInspeccion => ({
  id: l.identifier,
  tipo: l.equipment_types_detail[0]?.name ?? l.name,
  version: l.version,
  secciones: l.sections.map((s) => ({ titulo: s.title, items: s.items.map((i) => ({ texto: i.text, critico: i.is_critical })) })),
});

// ---------------------------------------------------------------------------
// HTTP con token JWT (y renovación automática del access token)
// ---------------------------------------------------------------------------

let access = "";
let refresh = "";

// La vista principal se suscribe para volver al login si la sesión ya no es válida.
let alVencer: (() => void) | null = null;
export function alVencerSesion(fn: () => void) {
  alVencer = fn;
  return () => { if (alVencer === fn) alVencer = null; };
}

/** Convierte cualquier valor de error de DRF (texto, lista, objeto anidado) en una lista de textos. */
function aplanar(v: unknown): string[] {
  if (v == null) return [];
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(aplanar);
  if (typeof v === "object") return Object.values(v).flatMap(aplanar);
  return [String(v)];
}

async function crearError(r: Response, campos: Campos): Promise<ApiError> {
  const cuerpo = await r.json().catch(() => ({}));
  const datos = (cuerpo && typeof cuerpo === "object" && "error" in cuerpo ? cuerpo.error : cuerpo) ?? {};
  const errores: Record<string, string[]> = {};
  const entradas = typeof datos === "object" && !Array.isArray(datos) ? Object.entries(datos) : [["detail", datos]];
  for (const [k, v] of entradas) {
    const clave = k === "non_field_errors" ? "detail" : campos[k] ?? k;
    const textos = aplanar(v);
    if (textos.length) errores[clave] = [...(errores[clave] ?? []), ...textos];
  }
  if (!Object.keys(errores).length && r.status >= 500) errores.detail = ["El servidor tuvo un problema. Inténtalo de nuevo."];
  return new ApiError(r.status, errores);
}

async function renovarToken(): Promise<boolean> {
  if (!refresh) return false;
  const r = await fetch(`${API_URL}/api/auth/refresh/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh }) }).catch(() => null);
  if (!r?.ok) return false;
  access = (await r.json()).access;
  return true;
}

async function http<T>(metodo: string, ruta: string, cuerpo?: unknown, campos: Campos = {}, reintento = true): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${API_URL}/api${ruta}`, {
      method: metodo,
      headers: { "Content-Type": "application/json", ...(access ? { Authorization: `Bearer ${access}` } : {}) },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ApiError(0, { detail: ["No se pudo conectar con el servidor. Revisa tu conexión."] });
  }
  // El access token dura pocos minutos: si venció, se renueva una vez y se repite la petición.
  if (r.status === 401 && reintento && !ruta.startsWith("/auth/") && (await renovarToken())) return http(metodo, ruta, cuerpo, campos, false);
  if (r.status === 401 && !ruta.startsWith("/auth/")) { access = refresh = ""; alVencer?.(); }
  if (!r.ok) throw await crearError(r, campos);
  return (r.status === 204 ? undefined : await r.json()) as T;
}

// Los roles se identifican por nombre en el front y por código en el backend.
let rolesCache: RolApi[] = [];
async function codigoDeRol(nombre: string) {
  let rol = rolesCache.find((r) => r.name === nombre);
  if (!rol) { rolesCache = await http<RolApi[]>("GET", "/accounts/roles/"); rol = rolesCache.find((r) => r.name === nombre); }
  if (!rol) throw new ApiError(400, { rol: ["El rol seleccionado no existe."] });
  return rol.code;
}

// Los tipos se identifican por nombre en el front y por id en el backend.
async function idDeTipo(nombre: string) {
  const tipo = (await http<TipoApi[]>("GET", "/catalog/equipment-types/")).find((t) => t.name === nombre);
  if (!tipo) throw new ApiError(400, { tipo: ["El tipo de equipo no existe."] });
  return tipo.id;
}

async function datosUsuario(d: Partial<Usuario>) {
  const salida = traducir(d, CAMPOS_USUARIO);
  if (d.rol !== undefined) salida.role = await codigoDeRol(d.rol);
  return salida;
}

async function datosEquipo(d: Partial<Equipo>) {
  const salida = traducir(d, CAMPOS_EQUIPO, {
    codigo: (v: string) => v.trim().toUpperCase(),
    placa: (v: string) => v.trim().toUpperCase(),
    anio: (v: string) => (v ? Number(v) : null),
    estado: (v: EstadoEquipo) => ESTADO_API[v],
  });
  if (d.tipo !== undefined) salida.equipment_type = await idDeTipo(d.tipo);
  return salida;
}

const httpApi: Api = {
  auth: {
    async login(usuario, clave) {
      const s = await http<SesionApi>("POST", "/auth/login/", { username: usuario, password: clave });
      access = s.access;
      refresh = s.refresh;
      const u = s.user;
      return { token: s.access, nombre: u.full_name || u.username, usuario: u.username, rol: u.role_name, esAdmin: u.is_admin, debeCambiarClave: u.must_change_password };
    },
    async logout() {
      if (access) await http("POST", "/accounts/logout/", { refresh }).catch(() => undefined);
      access = refresh = "";
      rolesCache = [];
    },
    cambiarClave: (actual, nueva) => http("POST", "/accounts/me/change-password/", { current_password: actual, new_password: nueva }, CAMPOS_CLAVE),
  },
  usuarios: {
    listar: async () => (await http<UsuarioApi[]>("GET", "/accounts/users/")).map(aUsuario),
    async crear(datos) {
      const u = await http<UsuarioApi>("POST", "/accounts/users/", await datosUsuario(datos), CAMPOS_USUARIO);
      return { ...aUsuario(u), claveTemporal: u.temporary_password };
    },
    actualizar: async (id, datos) => aUsuario(await http<UsuarioApi>("PATCH", `/accounts/users/${id}/`, await datosUsuario(datos), CAMPOS_USUARIO)),
    restablecerClave: async (id) => (await http<{ temporary_password: string }>("POST", `/accounts/users/${id}/reset-password/`)).temporary_password,
  },
  roles: {
    async listar() {
      rolesCache = await http<RolApi[]>("GET", "/accounts/roles/");
      return rolesCache.map(aRol);
    },
    async crear(nombre, soloConsulta) {
      const r = await http<RolApi>("POST", "/accounts/roles/", { name: nombre, read_only: soloConsulta }, CAMPOS_ROL);
      rolesCache = [...rolesCache, r];
      return aRol(r);
    },
    async guardarPermisos(id, permisos) {
      const cuerpo = Object.fromEntries(MODULOS.map((m) => [MODULO_API[m], NIVEL_API[permisos[m]]]));
      return aRol(await http<RolApi>("PUT", `/accounts/roles/${id}/permissions/`, cuerpo));
    },
  },
  tipos: {
    listar: async () => (await http<TipoApi[]>("GET", "/catalog/equipment-types/")).map(aTipo),
    crear: async (datos) => aTipo(await http<TipoApi>("POST", "/catalog/equipment-types/", traducir(datos, CAMPOS_TIPO), CAMPOS_TIPO)),
    actualizar: async (id, datos) => aTipo(await http<TipoApi>("PATCH", `/catalog/equipment-types/${id}/`, traducir(datos, CAMPOS_TIPO), CAMPOS_TIPO)),
    eliminar: (id) => http("DELETE", `/catalog/equipment-types/${id}/`),
  },
  equipos: {
    listar: async () => (await http<EquipoApi[]>("GET", "/catalog/equipments/")).map(aEquipo),
    crear: async (datos) => aEquipo(await http<EquipoApi>("POST", "/catalog/equipments/", await datosEquipo(datos), CAMPOS_EQUIPO)),
    actualizar: async (id, datos) => aEquipo(await http<EquipoApi>("PATCH", `/catalog/equipments/${encodeURIComponent(id)}/`, await datosEquipo(datos), CAMPOS_EQUIPO)),
  },
  listas: {
    listar: async () => (await http<ListaApi[]>("GET", "/catalog/checklists/")).map(aLista),
    crear: async (tipo) => aLista(await http<ListaApi>("POST", "/catalog/checklists/", { equipment_types: [await idDeTipo(tipo)], sections: [] }, CAMPOS_LISTA)),
    actualizar: async (id, { secciones }) => {
      const sections = secciones.map((s) => ({ title: s.titulo, items: s.items.map((i) => ({ text: i.texto, is_critical: !!i.critico })) }));
      return aLista(await http<ListaApi>("PATCH", `/catalog/checklists/${encodeURIComponent(id)}/`, { sections }, CAMPOS_LISTA));
    },
  },
};

export const api: Api = usaDatosDePrueba ? mockApi : httpApi;
