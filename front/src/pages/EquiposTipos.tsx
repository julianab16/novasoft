// Equipos y tipos: inventario de la flota y tipos de equipo.
import { useEffect, useState } from "react";
import { Cargando, Drawer, Field, Icon, Status, Tabs, Toast, btnGhost, btnPrimary, card, input, td, textoError, th, type Aviso, type Tone } from "../components/ui";
import { ApiError, api } from "../services/api";
import { ESTADOS_EQUIPO, type Equipo, type EstadoEquipo, type ListaInspeccion, type TipoEquipo } from "../types";

const tonoEstado: Record<EstadoEquipo, Tone> = { Disponible: "ok", "En mantenimiento": "warn", "Fuera de servicio": "danger" };
const horas = (h: string) => (!h ? "—" : /^\d+$/.test(h) ? `${h} h` : h);

export default function EquiposTipos() {
  const [tab, setTab] = useState("Equipos");
  const [tipos, setTipos] = useState<TipoEquipo[] | null>(null);
  const [equipos, setEquipos] = useState<Equipo[] | null>(null);
  const [listas, setListas] = useState<ListaInspeccion[]>([]);
  const recargar = () => Promise.all([api.tipos.listar(), api.equipos.listar(), api.listas.listar()]).then(([t, e, l]) => { setTipos(t); setEquipos(e); setListas(l); });
  useEffect(() => { recargar(); }, []);
  return <>
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-black sm:text-2xl">Equipos y tipos</h2><p className="mt-1 text-sm text-slate-500">Mantén actualizado el inventario de la flota.</p></div><Tabs tabs={["Equipos", "Tipos de equipo"]} value={tab} onChange={setTab} /></div>
    {!tipos || !equipos ? <Cargando /> : tab === "Equipos" ? <Equipos equipos={equipos} setEquipos={setEquipos} tipos={tipos} /> : <Tipos tipos={tipos} equipos={equipos} listas={listas} recargar={recargar} />}
  </>;
}

type DatosEquipo = Omit<Equipo, "id" | "modificado">;

function Equipos({ equipos, setEquipos, tipos }: { equipos: Equipo[]; setEquipos: (e: Equipo[]) => void; tipos: TipoEquipo[] }) {
  const [filtro, setFiltro] = useState("Todos"); const [q, setQ] = useState("");
  const [form, setForm] = useState<{ id?: number; modificado?: string; data: DatosEquipo } | null>(null);
  const [error, setError] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const activos = tipos.filter((t) => t.activo);
  const vistos = equipos.filter((e) => (filtro === "Todos" || e.tipo === filtro) && `${e.codigo} ${e.marca}`.toLowerCase().includes(q.toLowerCase()));

  const abrir = (e?: Equipo) => {
    setError({});
    if (e) { const { id, modificado, ...data } = e; setForm({ id, modificado, data }); }
    else setForm({ data: { codigo: "", tipo: activos[0]?.nombre ?? "", marca: "", serie: "", anio: "", horometro: "", estado: "Disponible" } });
  };
  const set = (k: keyof DatosEquipo, v: string) => form && setForm({ ...form, data: { ...form.data, [k]: v } });
  const guardar = async () => {
    if (!form) return; const d = { ...form.data, codigo: form.data.codigo.trim().toUpperCase() }; const e: Record<string, string> = {};
    if (!d.codigo) e.codigo = "Escribe el código o la placa.";
    if (!d.marca.trim()) e.marca = "Escribe la marca o el modelo.";
    if (!d.tipo) e.tipo = "Elige el tipo de equipo.";
    setError(e); if (Object.keys(e).length) return;
    setGuardando(true);
    try {
      const x = form.id ? await api.equipos.actualizar(form.id, d) : await api.equipos.crear(d);
      setEquipos(form.id ? equipos.map((y) => (y.id === x.id ? x : y)) : [x, ...equipos]);
      setAviso({ texto: form.id ? "Cambios guardados" : "Equipo registrado" }); setForm(null);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.campos).length) setError(Object.fromEntries(Object.entries(err.campos).map(([k, v]) => [k, v[0]])));
      else setAviso({ texto: textoError(err), error: true });
    } finally { setGuardando(false); }
  };

  return <>
    <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4">{ESTADOS_EQUIPO.map((s) => <article key={s} className={`${card} p-5`}><Status type={tonoEstado[s]}>{s}</Status><p className="mt-3 text-3xl font-black">{equipos.filter((e) => e.estado === s).length}</p></article>)}<article className={`${card} p-5`}><p className="text-sm font-bold text-slate-500">Total de equipos</p><p className="mt-3 text-3xl font-black">{equipos.length}</p></article></div>
    <article className={`${card} overflow-hidden`}>
      <div className="flex flex-col gap-3 p-4 sm:p-5 md:flex-row md:items-center">
        <label className="relative min-w-0 flex-1"><Icon name="search" size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} className={`${input} w-full border-slate-200 pl-11`} placeholder="Buscar por código, placa o modelo" /></label>
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className={`${input} w-full shrink-0 border-slate-200 md:w-56`}><option>Todos</option>{tipos.map((t) => <option key={t.id}>{t.nombre}</option>)}</select>
        <button className={btnPrimary} onClick={() => abrir()}><Icon name="plus" size={19} />Registrar equipo</button>
      </div>
      <ul className="divide-y divide-slate-100 border-t border-slate-100 lg:hidden">{vistos.map((e) => <li key={e.id}><button onClick={() => abrir(e)} className="flex w-full items-start gap-3 p-4 text-left">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#F5B800]/15 text-[#8A6500]"><Icon name="equipment" size={19} /></span>
        <span className="min-w-0 flex-1"><span className="block font-black">{e.codigo}</span><span className="mt-0.5 block text-sm font-semibold text-slate-500">{e.tipo} · {e.marca}</span>{e.horometro && <span className="block text-xs font-bold text-slate-500">Horómetro: {horas(e.horometro)}</span>}<span className="mt-2 block"><Status type={tonoEstado[e.estado]}>{e.estado}</Status></span><span className="mt-2 block text-xs font-semibold text-slate-400">{e.modificado}</span></span>
        <span className="text-sm font-black text-[#8A6500]">Editar</span>
      </button></li>)}</ul>
      <table className="hidden w-full border-t border-slate-100 lg:table">
        <thead className="bg-slate-50"><tr><th className={th}>Código / placa</th><th className={th}>Tipo</th><th className={th}>Marca / modelo</th><th className={th}>Horómetro</th><th className={th}>Estado</th><th className={th}>Última modificación</th><th className={th} /></tr></thead>
        <tbody>{vistos.map((e) => <tr key={e.id} className="border-t border-slate-100">
          <td className={td}><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#F5B800]/15 text-[#8A6500]"><Icon name="equipment" size={18} /></span><span className="font-black">{e.codigo}</span></div></td>
          <td className={`${td} font-bold`}>{e.tipo}</td><td className={`${td} font-semibold text-slate-600`}>{e.marca}{e.anio && <span className="block text-xs text-slate-400">Año {e.anio}</span>}</td><td className={`${td} font-bold`}>{horas(e.horometro)}</td>
          <td className={td}><Status type={tonoEstado[e.estado]}>{e.estado}</Status></td>
          <td className={`${td} text-xs font-semibold text-slate-400`}>{e.modificado}</td>
          <td className={`${td} text-right`}><button onClick={() => abrir(e)} className="text-sm font-black text-[#8A6500]">Editar</button></td></tr>)}</tbody>
      </table>
      {vistos.length === 0 && <p className="p-10 text-center text-sm font-semibold text-slate-400">No hay equipos que coincidan con la búsqueda.</p>}
    </article>
    {form && <Drawer title={form.id ? `Editar ${form.data.codigo}` : "Registrar equipo"} subtitle="El código o la placa no se puede repetir." onClose={() => setForm(null)} footer={<><button className={`${btnGhost} flex-1`} onClick={() => setForm(null)}>Cancelar</button><button disabled={guardando} className={`${btnPrimary} flex-1`} onClick={guardar}><Icon name="check" size={19} />{guardando ? "Guardando..." : "Guardar"}</button></>}>
      <Field label="Código o placa *" error={error.codigo}><input className={`${input} w-full uppercase ${error.codigo ? "border-red-500" : "border-slate-200"}`} value={form.data.codigo} onChange={(e) => set("codigo", e.target.value)} placeholder="Ej. CAR-10 o VOL-53" /></Field>
      <Field label="Tipo de equipo *" error={error.tipo}><select className={`${input} w-full border-slate-200`} value={form.data.tipo} onChange={(e) => set("tipo", e.target.value)}>{activos.map((t) => <option key={t.id}>{t.nombre}</option>)}</select></Field>
      <Field label="Marca / modelo *" error={error.marca}><input className={`${input} w-full ${error.marca ? "border-red-500" : "border-slate-200"}`} value={form.data.marca} onChange={(e) => set("marca", e.target.value)} placeholder="Ej. Caterpillar 950H" /></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="No. de serie"><input className={`${input} w-full border-slate-200`} value={form.data.serie} onChange={(e) => set("serie", e.target.value)} placeholder="Opcional" /></Field><Field label="Año"><input className={`${input} w-full border-slate-200`} value={form.data.anio} inputMode="numeric" onChange={(e) => set("anio", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Ej. 2014" /></Field></div>
      <Field label="Horómetro actual"><span className="relative block"><input className={`${input} w-full border-slate-200 pr-12`} value={form.data.horometro} inputMode="numeric" onChange={(e) => set("horometro", e.target.value)} placeholder="Horas" /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">h</span></span></Field>
      <Field label="Estado *"><div className="grid grid-cols-3 gap-2">{ESTADOS_EQUIPO.map((s) => <button key={s} onClick={() => set("estado", s)} className={`min-h-12 rounded-xl border-2 px-2 text-xs font-black ${form.data.estado === s ? "border-[#F5B800] bg-[#F5B800]/15 text-[#684C00]" : "border-slate-200 text-slate-600"}`}>{s}</button>)}</div></Field>
      {form.id && <div className="rounded-xl bg-slate-50 p-4 text-xs font-semibold text-slate-500"><p className="font-black text-slate-700">Última modificación</p><p className="mt-1">{form.modificado}</p><p className="mt-2">Al guardar se registrará tu usuario y la fecha.</p></div>}
    </Drawer>}
    {aviso && <Toast text={aviso.texto} error={aviso.error} onClose={() => setAviso(null)} />}
  </>;
}

function Tipos({ tipos, equipos, listas, recargar }: { tipos: TipoEquipo[]; equipos: Equipo[]; listas: ListaInspeccion[]; recargar: () => Promise<void> }) {
  const [form, setForm] = useState<{ id?: number; data: Omit<TipoEquipo, "id"> } | null>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState<Aviso>(null);
  const accion = async (fn: () => Promise<unknown>, texto: string) => {
    try { await fn(); await recargar(); setAviso({ texto }); return true; }
    catch (e) { setAviso({ texto: textoError(e), error: true }); return false; }
  };
  const guardar = async () => {
    if (!form) return; const nombre = form.data.nombre.trim();
    if (!nombre) return setError("Escribe el nombre del tipo.");
    try {
      if (form.id) await api.tipos.actualizar(form.id, { ...form.data, nombre }); else await api.tipos.crear({ ...form.data, nombre });
      await recargar(); setAviso({ texto: form.id ? "Cambios guardados" : "Tipo de equipo creado" }); setForm(null);
    } catch (e) { setError(textoError(e)); }
  };

  return <>
    <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
      {tipos.map((t) => { const n = equipos.filter((e) => e.tipo === t.nombre).length; const lista = listas.find((l) => l.tipo === t.nombre); return <article key={t.id} className={`${card} p-5 ${t.activo ? "" : "opacity-60"}`}>
        <div className="flex items-start justify-between"><span className="grid size-12 place-items-center rounded-xl bg-[#F5B800]/15 text-[#8A6500]"><Icon name="equipment" /></span><Status type={t.activo ? "ok" : "neutral"}>{t.activo ? "Activo" : "Inactivo"}</Status></div>
        <h3 className="mt-4 text-lg font-black">{t.nombre}</h3><p className="mt-1 min-h-10 text-sm text-slate-500">{t.descripcion}</p>
        <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3 text-sm"><div className="flex justify-between"><span className="font-semibold text-slate-500">Equipos asociados</span><span className="font-black">{n}</span></div><div className="flex justify-between"><span className="font-semibold text-slate-500">Lista de inspección</span><span className="font-black text-[#8A6500]">{lista ? `${lista.secciones.reduce((k, s) => k + s.items.length, 0)} ítems` : "Sin lista"}</span></div></div>
        <div className="mt-4 flex gap-2">
          <button onClick={() => { setError(""); setForm({ id: t.id, data: { nombre: t.nombre, descripcion: t.descripcion, activo: t.activo } }); }} className={`${btnGhost} h-11 flex-1`}>Editar</button>
          <button onClick={() => accion(() => api.tipos.actualizar(t.id, { activo: !t.activo }), t.activo ? "Tipo desactivado" : "Tipo activado")} className="h-11 flex-1 rounded-xl text-sm font-black text-slate-600 hover:bg-slate-100">{t.activo ? "Desactivar" : "Activar"}</button>
          <button disabled={n > 0} title={n > 0 ? `No se puede eliminar: tiene ${n} equipos asociados` : "Eliminar"} onClick={() => accion(() => api.tipos.eliminar(t.id), "Tipo eliminado")} className="grid size-11 place-items-center rounded-xl text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"><Icon name="trash" size={19} /></button>
        </div>
        {n > 0 && <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-slate-400"><Icon name="lock" size={14} />No se puede eliminar mientras tenga equipos.</p>}
      </article>; })}
      <button onClick={() => { setError(""); setForm({ data: { nombre: "", descripcion: "", activo: true } }); }} className="grid min-h-40 place-items-center rounded-2xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-[#F5B800] hover:text-[#8A6500] sm:min-h-72"><span className="text-center"><span className="mx-auto grid size-12 place-items-center rounded-full bg-slate-100"><Icon name="plus" /></span><span className="mt-3 block text-sm font-black">Nuevo tipo de equipo</span></span></button>
    </div>
    {form && <Drawer title={form.id ? "Editar tipo" : "Nuevo tipo de equipo"} onClose={() => setForm(null)} footer={<><button className={`${btnGhost} flex-1`} onClick={() => setForm(null)}>Cancelar</button><button className={`${btnPrimary} flex-1`} onClick={guardar}><Icon name="check" size={19} />Guardar</button></>}>
      <Field label="Nombre *" error={error}><input className={`${input} w-full ${error ? "border-red-500" : "border-slate-200"}`} value={form.data.nombre} onChange={(e) => setForm({ ...form, data: { ...form.data, nombre: e.target.value } })} placeholder="Ej. Compactadoras" /></Field>
      <Field label="Descripción"><textarea className={`${input} min-h-24 w-full resize-none border-slate-200 py-3`} value={form.data.descripcion} onChange={(e) => setForm({ ...form, data: { ...form.data, descripcion: e.target.value } })} placeholder="Qué equipos incluye" /></Field>
    </Drawer>}
    {aviso && <Toast text={aviso.texto} error={aviso.error} onClose={() => setAviso(null)} />}
  </>;
}
