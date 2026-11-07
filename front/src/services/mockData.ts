// Datos de prueba. Se usan mientras no exista backend (VITE_API_URL vacío).
// Tipos, equipos y listas salen del Excel del cliente
// "CONTROL PREOPERACIONAL EQUIPOS MÓVILES - TCHO" (hojas Respaldo y REGISTRO).
import { MODULOS, type Equipo, type Item, type ListaInspeccion, type Modulo, type Nivel, type Rol, type Seccion, type TipoEquipo, type Usuario } from "../types";

export const usuarios: Usuario[] = [
  { id: 1, nombre: "Carlos Rodríguez", documento: "16742859", usuario: "crodriguez", rol: "Operario", activo: true },
  { id: 2, nombre: "Jhon Valencia", documento: "94381220", usuario: "jvalencia", rol: "Operario", activo: true },
  { id: 3, nombre: "Andrés Mosquera", documento: "1130644871", usuario: "amosquera", rol: "Jefe de Taller", activo: true },
  { id: 4, nombre: "Laura Martínez", documento: "31987456", usuario: "lmartinez", rol: "SST", activo: true },
  { id: 5, nombre: "Óscar Mina", documento: "16289004", usuario: "omina", rol: "Operario", activo: false },
  { id: 6, nombre: "Patricia Gómez", documento: "66851230", usuario: "pgomez", rol: "Administrador", activo: true },
];
// Contraseña de prueba para cualquier usuario activo
export const CLAVE_PRUEBA = "Sigope2025";

const permisosDe = (gestiona: readonly Modulo[], ve: readonly Modulo[]) =>
  Object.fromEntries(MODULOS.map((m) => [m, gestiona.includes(m) ? "Ver y gestionar" : ve.includes(m) ? "Solo ver" : "Sin acceso"])) as Record<Modulo, Nivel>;

export const roles: Rol[] = [
  { id: 1, nombre: "Operario", base: true, permisos: permisosDe(["Inspecciones", "Novedades e incidentes"], []) },
  { id: 2, nombre: "Jefe de Taller", base: true, permisos: permisosDe(["Mantenimientos"], ["Inspecciones", "Novedades e incidentes", "Reportes y tableros"]) },
  { id: 3, nombre: "SST", base: true, permisos: permisosDe(["Seguimiento SST"], ["Inspecciones", "Novedades e incidentes", "Mantenimientos", "Documentos", "Reportes y tableros"]) },
  { id: 4, nombre: "Administrador", base: true, permisos: permisosDe(MODULOS, []) },
];

export const tipos: TipoEquipo[] = [
  { id: 1, nombre: "Cargadores", descripcion: "Cargadores Caterpillar y SEM-CAT", activo: true },
  { id: 2, nombre: "Volquetas", descripcion: "Volquetas de fabricación propia y Foton Auman 8x4", activo: true },
  { id: 3, nombre: "Compresores / Wagon drill", descripcion: "Compresores Kaishan y Atlas Copco", activo: true },
];

const eq = (codigo: string, tipo: string, marca: string, serie: string, anio: string, horometro: string): Omit<Equipo, "id"> => ({ codigo, placa: "", tipo, marca, serie, anio, horometro, estado: "Disponible", modificado: "Carga inicial · 28/10/2026" });
const equiposBase = [
  eq("CAR-1", "Cargadores", "Caterpillar 966C", "18B01190", "1990", "6509"),
  eq("CAR-2", "Cargadores", "Caterpillar 960F", "9ZJ00219", "1995", "648"),
  eq("CAR-3", "Cargadores", "Caterpillar 950H", "0950HVM1G00856", "2007", "30189"),
  eq("CAR-4", "Cargadores", "Caterpillar 950H", "0950HLM1G00861", "2007", "30590"),
  eq("CAR-5", "Cargadores", "Caterpillar 950H", "0950HPJX00446", "2014", "19394"),
  eq("CAR-6", "Cargadores", "SEM-CAT 659C", "A1408005AH1408001", "2014", "9931"),
  eq("CAR-7", "Cargadores", "SEM-CAT 669C", "SEM00669AS6J00582", "2017", "9750"),
  eq("CAR-8", "Cargadores", "SEM-CAT 669C", "SEM00669ES6J00535", "2019", "SM/SS"),
  eq("CAR-9", "Cargadores", "SEM-CAT 668D", "SEM00668HS6800271", "2024", "2892"),
  ...(["35", "36", "41", "42", "43", "45", "46"] as const).map((n, i) => eq(`VOL-${n}`, "Volquetas", "Fabricación propia", "Fab. propia", "", ["2831", "4038", "6255", "4397", "2173", "3226", "1756"][i])),
  eq("VOL-50", "Volquetas", "Foton Auman 8x4", "Pendiente", "", "5640"),
  eq("VOL-51", "Volquetas", "Foton Auman 8x4", "Pendiente", "", "5481"),
  eq("VOL-52", "Volquetas", "Foton Auman 8x4", "Pendiente", "", "3357"),
  eq("KAISHAN", "Compresores / Wagon drill", "Kaishan 10/12-LGCY", "Pendiente", "", "1688"),
  eq("XAS 750", "Compresores / Wagon drill", "Atlas Copco XAS750", "Pendiente", "", "9242"),
];
export const equipos: Equipo[] = equiposBase.map((e) => ({ id: e.codigo, ...e }));

const it = (t: string): Item => ({ texto: t });
const sec = (titulo: string, items: string[]): Seccion => ({ titulo, items: items.map((t) => it(t)) });
const llantas = ["Desgaste", "Presión", "Pernos", "Rines", "Alineación"];
const carroceria = ["Limpieza", "Deterioro", "Exosto"];
const hidraulico = ["Mangueras", "Acoples", "Cilindros", "Retenedores", "Nivel de aceite"];
const motorBase = ["Filtro de aceite de motor", "Combustible", "Nivel de aceite de motor", "Nivel de aceite caja de transmisión", "Nivel de agua / refrigerante"];
const bateria = ["Bornes", "Nivel de agua"];
const parabrisas = ["Vidrios", "Plumillas", "Nivel de agua"];
const chasis = ["Fisuras", "Tornillos", "Puentes", "Vigas"];
const luces = ["Altas", "Medias", "Bajas", "Direccionales", "Estacionarias", "Stop", "Reversa", "Exploradoras"];
const emergencia = ["Botiquín", "Extintor vigente", "Conos / triángulos reflectivos"];
export const listas: ListaInspeccion[] = [
  { id: "CHK-CARGADORES", tipo: "Cargadores", version: 1, secciones: [
    sec("Llantas", [...llantas, "Orugas"]),
    sec("Balde", ["Cilindros hidráulicos de levante", "Lámina", "Uñas", "Herramienta de desgaste"]),
    sec("Carrocería", carroceria), sec("Sistema hidráulico", hidraulico), sec("Motor", motorBase), sec("Batería", bateria),
    sec("Aire", ["Filtro aire de motor", "Filtro aire acondicionado", "Mangueras - tuberías", "Conexiones", "Frenos"]),
    sec("Frenos", ["Nivel de líquido", "Freno de parqueo", "Pastillas"]),
    sec("Parabrisas", parabrisas), sec("Chasis", chasis),
    sec("Cabina", ["Cojinería", "Aseo", "Bocina / alarma de reversa", "Aire acondicionado", "Puertas / manijas", "Volante / dirección", "Testigos tablero", "Cinturones de seguridad", "Palanca / caja de cambios", "Palanca mando de balde", "Retrovisores"]),
    sec("Indicadores en tablero", ["Presión aceite de motor", "Presión de aire", "RPM", "Nivel de combustible", "Carga de batería", "Direccionales", "Temperatura", "Refrigerante motor", "Luces"]),
    sec("Luces", luces), sec("Equipo de emergencia", emergencia),
  ] },
  { id: "CHK-VOLQUETAS", tipo: "Volquetas", version: 1, secciones: [
    sec("Llantas", llantas),
    sec("Volco", ["Cilindro hidráulico de levante", "Lámina", "Estado general"]),
    sec("Transmisión", ["Espárragos", "Fugas", "Porta-martillos", "Tornillos soportes corbatines"]),
    sec("Carrocería", carroceria), sec("Sistema hidráulico", hidraulico), sec("Motor", [...motorBase, "Soportes"]), sec("Batería", bateria),
    sec("Aire", ["Filtro aire de motor", "Mangueras - tuberías", "Conexiones", "Frenos"]),
    sec("Frenos", ["Campana", "Bandas", "Freno de emergencia", "Embrague / clutch"]),
    sec("Parabrisas", parabrisas), sec("Chasis", chasis),
    sec("Cabina", ["Cojinería", "Aseo", "Bocina / alarma de reversa", "Volante / dirección", "Testigos tablero", "Cinturones de seguridad", "Palanca / caja de cambios", "Palanca mando volco", "Retrovisores"]),
    sec("Indicadores en tablero", ["Presión aceite de motor", "Presión de aire", "RPM", "Nivel de combustible", "Temperatura", "Refrigerante motor", "Luces"]),
    sec("Luces", luces), sec("Equipo de emergencia", emergencia),
  ] },
  { id: "CHK-COMPRESORES-WAGON-DRILL", tipo: "Compresores / Wagon drill", version: 1, secciones: [
    sec("Motor", ["Nivel de aceite unidad", "Nivel de refrigerante", "Nivel de aceite motor", "Batería", "Bornes", "Manguera filtro"]),
    sec("Chasis", chasis),
    sec("Aire", ["Filtro aire de motor", "Filtro aire unidad"]),
    sec("Indicadores en tablero", ["Presión aceite de motor", "Presión de aire", "RPM", "Nivel de combustible", "Carga de batería", "Temperatura", "Refrigerante motor"]),
    sec("Equipo de emergencia", ["Extintor vigente"]),
  ] },
];
