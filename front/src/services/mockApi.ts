// Backend simulado en memoria. Implementa el mismo contrato que el backend real (ver api.ts),
// con las mismas validaciones básicas. Los cambios se pierden al recargar la página.
import { MODULOS, type Nivel, type Modulo } from "../types";
import type { Api } from "./api";
import { ApiError } from "./ApiError";
import * as datos from "./mockData";

const db = structuredClone({ usuarios: datos.usuarios, roles: datos.roles, tipos: datos.tipos, equipos: datos.equipos, listas: datos.listas });
let sesionActual = "";

const esperar = <T,>(valor: T): Promise<T> => new Promise((ok) => setTimeout(() => ok(structuredClone(valor)), 150));
const siguienteId = (lista: { id: number }[]) => Math.max(0, ...lista.map((x) => x.id)) + 1;
const hoy = () => new Date().toLocaleDateString("es-CO");
const claveTemporal = () => Math.random().toString(36).slice(2, 12);
const buscar = <T extends { id: number | string }>(lista: T[], id: T["id"]) => {
  const x = lista.find((y) => y.id === id);
  if (!x) throw new ApiError(404, { detail: ["No encontrado."] });
  return x;
};

export const mockApi: Api = {
  auth: {
    async login(usuario, clave) {
      const u = db.usuarios.find((x) => x.usuario === usuario || x.documento === usuario);
      if (!u || !u.activo || clave !== datos.CLAVE_PRUEBA) throw new ApiError(401, { detail: ["Credenciales inválidas."] });
      sesionActual = u.nombre;
      return esperar({ token: "token-de-prueba", nombre: u.nombre, usuario: u.usuario, rol: u.rol, esAdmin: u.rol === "Administrador", debeCambiarClave: false });
    },
    async logout() {
      sesionActual = "";
    },
    async cambiarClave(actual) {
      if (actual !== datos.CLAVE_PRUEBA) throw new ApiError(400, { actual: ["La contraseña actual no es correcta."] });
      await esperar(null);
    },
  },

  usuarios: {
    listar: async () => esperar(db.usuarios),
    async crear(d) {
      if (db.usuarios.some((u) => u.documento === d.documento)) throw new ApiError(400, { documento: ["Ya existe un usuario con este documento."] });
      if (db.usuarios.some((u) => u.usuario === d.usuario)) throw new ApiError(400, { usuario: ["Este usuario ya está en uso."] });
      const nuevo = { ...d, id: siguienteId(db.usuarios) };
      db.usuarios.unshift(nuevo);
      return esperar({ ...nuevo, claveTemporal: claveTemporal() });
    },
    async actualizar(id, d) {
      if (d.documento && db.usuarios.some((u) => u.id !== id && u.documento === d.documento)) throw new ApiError(400, { documento: ["Ya existe un usuario con este documento."] });
      if (d.usuario && db.usuarios.some((u) => u.id !== id && u.usuario === d.usuario)) throw new ApiError(400, { usuario: ["Este usuario ya está en uso."] });
      return esperar(Object.assign(buscar(db.usuarios, id), d));
    },
    async restablecerClave(id) {
      buscar(db.usuarios, id);
      return esperar(claveTemporal());
    },
  },

  roles: {
    listar: async () => esperar(db.roles),
    async crear(nombre, soloConsulta) {
      if (db.roles.some((r) => r.nombre.toLowerCase() === nombre.toLowerCase())) throw new ApiError(400, { nombre: ["Ya existe un rol con este nombre."] });
      const permisos = Object.fromEntries(MODULOS.map((m) => [m, soloConsulta ? "Solo ver" : "Sin acceso"])) as Record<Modulo, Nivel>;
      const nuevo = { id: siguienteId(db.roles), nombre, base: false, permisos };
      db.roles.push(nuevo);
      return esperar(nuevo);
    },
    async guardarPermisos(id, permisos) {
      const r = buscar(db.roles, id);
      r.permisos = { ...permisos };
      return esperar(r);
    },
  },

  tipos: {
    listar: async () => esperar(db.tipos),
    async crear(d) {
      if (db.tipos.some((t) => t.nombre.toLowerCase() === d.nombre.toLowerCase())) throw new ApiError(400, { nombre: ["Ya existe un tipo con este nombre."] });
      const nuevo = { ...d, id: siguienteId(db.tipos) };
      db.tipos.push(nuevo);
      return esperar(nuevo);
    },
    async actualizar(id, d) {
      if (d.nombre && db.tipos.some((t) => t.id !== id && t.nombre.toLowerCase() === d.nombre!.toLowerCase())) throw new ApiError(400, { nombre: ["Ya existe un tipo con este nombre."] });
      const t = buscar(db.tipos, id);
      const anterior = t.nombre;
      Object.assign(t, d);
      if (d.nombre && d.nombre !== anterior) {
        db.equipos.forEach((e) => { if (e.tipo === anterior) e.tipo = d.nombre!; });
        db.listas.forEach((l) => { if (l.tipo === anterior) l.tipo = d.nombre!; });
      }
      return esperar(t);
    },
    async eliminar(id) {
      const t = buscar(db.tipos, id);
      if (db.equipos.some((e) => e.tipo === t.nombre)) throw new ApiError(400, { detail: ["No se puede eliminar un tipo con equipos asociados."] });
      db.tipos = db.tipos.filter((x) => x.id !== id);
      db.listas = db.listas.filter((l) => l.tipo !== t.nombre);
      await esperar(null);
    },
  },

  equipos: {
    listar: async () => esperar(db.equipos),
    async crear(d) {
      if (db.equipos.some((e) => e.codigo.toUpperCase() === d.codigo.toUpperCase())) throw new ApiError(400, { codigo: ["Ya existe un equipo con este código o placa."] });
      const nuevo = { ...d, id: d.codigo.toUpperCase(), codigo: d.codigo.toUpperCase(), modificado: `${sesionActual || "Administrador"} · ${hoy()}` };
      db.equipos.unshift(nuevo);
      return esperar(nuevo);
    },
    async actualizar(id, d) {
      if (d.codigo && d.codigo.toUpperCase() !== id) throw new ApiError(400, { codigo: ["El código de un equipo no se puede cambiar."] });
      return esperar(Object.assign(buscar(db.equipos, id), d, { modificado: `${sesionActual || "Administrador"} · ${hoy()}` }));
    },
  },

  listas: {
    listar: async () => esperar(db.listas),
    async crear(tipo) {
      if (db.listas.some((l) => l.tipo === tipo)) throw new ApiError(400, { tipo: ["Este tipo de equipo ya tiene lista."] });
      const nueva = { id: `CHK-${tipo.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`, tipo, version: 1, secciones: [{ titulo: "Sección 1", items: [{ texto: "" }] }] };
      db.listas.push(nueva);
      return esperar(nueva);
    },
    async actualizar(id, d) {
      const l = buscar(db.listas, id);
      l.secciones = structuredClone(d.secciones);
      l.version += 1; // las inspecciones anteriores conservan la versión que respondieron
      return esperar(l);
    },
  },
};
