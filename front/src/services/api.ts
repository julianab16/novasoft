// Capa de servicios: TODA la comunicación con el backend pasa por aquí.
// Las vistas solo llaman a `api.*`, nunca a fetch directamente.
//
// - Si VITE_API_URL está vacío, se usan datos de prueba en memoria (mockApi.ts).
// - Si tiene una URL, se hacen peticiones HTTP a los endpoints de `httpApi`.
//   Las rutas son una propuesta para Django REST Framework; si el backend usa otras,
//   solo hay que cambiarlas aquí.

import type { Equipo, ListaInspeccion, Modulo, Nivel, Rol, Sesion, TipoEquipo, Usuario } from "../types";
import { ApiError } from "./ApiError";
import { mockApi } from "./mockApi";

export { ApiError };

export type Api = {
  auth: {
    login(usuario: string, clave: string): Promise<Sesion>;
    logout(): Promise<void>;
  };
  usuarios: {
    listar(): Promise<Usuario[]>;
    crear(datos: Omit<Usuario, "id">): Promise<Usuario>;
    actualizar(id: number, datos: Partial<Usuario>): Promise<Usuario>;
    restablecerClave(id: number): Promise<void>;
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
    actualizar(id: number, datos: Partial<Equipo>): Promise<Equipo>;
  };
  listas: {
    listar(): Promise<ListaInspeccion[]>;
    crear(tipo: string): Promise<ListaInspeccion>;
    actualizar(id: number, datos: Pick<ListaInspeccion, "secciones">): Promise<ListaInspeccion>;
  };
};

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "");
export const usaDatosDePrueba = !API_URL;

let token = "";

async function http<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  const r = await fetch(`${API_URL}/api${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  if (!r.ok) throw new ApiError(r.status, await r.json().catch(() => ({})));
  return (r.status === 204 ? undefined : await r.json()) as T;
}

const httpApi: Api = {
  auth: {
    async login(usuario, clave) {
      const s = await http<Sesion>("POST", "/auth/login/", { usuario, clave });
      token = s.token;
      return s;
    },
    async logout() {
      await http("POST", "/auth/logout/").catch(() => undefined);
      token = "";
    },
  },
  usuarios: {
    listar: () => http("GET", "/usuarios/"),
    crear: (datos) => http("POST", "/usuarios/", datos),
    actualizar: (id, datos) => http("PATCH", `/usuarios/${id}/`, datos),
    restablecerClave: (id) => http("POST", `/usuarios/${id}/restablecer-clave/`),
  },
  roles: {
    listar: () => http("GET", "/roles/"),
    crear: (nombre, soloConsulta) => http("POST", "/roles/", { nombre, solo_consulta: soloConsulta }),
    guardarPermisos: (id, permisos) => http("PUT", `/roles/${id}/permisos/`, permisos),
  },
  tipos: {
    listar: () => http("GET", "/tipos-equipo/"),
    crear: (datos) => http("POST", "/tipos-equipo/", datos),
    actualizar: (id, datos) => http("PATCH", `/tipos-equipo/${id}/`, datos),
    eliminar: (id) => http("DELETE", `/tipos-equipo/${id}/`),
  },
  equipos: {
    listar: () => http("GET", "/equipos/"),
    crear: (datos) => http("POST", "/equipos/", datos),
    actualizar: (id, datos) => http("PATCH", `/equipos/${id}/`, datos),
  },
  listas: {
    listar: () => http("GET", "/listas-inspeccion/"),
    crear: (tipo) => http("POST", "/listas-inspeccion/", { tipo }),
    actualizar: (id, datos) => http("PUT", `/listas-inspeccion/${id}/`, datos),
  },
};

export const api: Api = usaDatosDePrueba ? mockApi : httpApi;
