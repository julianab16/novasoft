// Listas de inspección: una lista por tipo de equipo.
import { useEffect, useState } from "react";
import { Cargando, Drawer, Field, Icon, Toast, btnGhost, btnPrimary, card, input, textoError, type Aviso } from "../components/ui";
import { api } from "../services/api";
import type { ListaInspeccion, TipoEquipo } from "../types";

const contar = (l: ListaInspeccion) => l.secciones.reduce((n, s) => n + s.items.length, 0);

export default function ListasInspeccion() {
  const [listas, setListas] = useState<ListaInspeccion[] | null>(null);
  const [tipos, setTipos] = useState<TipoEquipo[]>([]);
  const [selId, setSelId] = useState<number>();
  const [draft, setDraft] = useState<ListaInspeccion | null>(null);
  const [abierta, setAbierta] = useState(0);
  const [nueva, setNueva] = useState<{ tipo: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  useEffect(() => {
    Promise.all([api.listas.listar(), api.tipos.listar()]).then(([l, t]) => {
      setListas(l); setTipos(t);
      if (l[0]) { setSelId(l[0].id); setDraft(structuredClone(l[0])); }
    }).catch((e) => setAviso({ texto: textoError(e), error: true }));
  }, []);
  if (!listas) return <Cargando />;

  const sel = listas.find((l) => l.id === selId);
  const sucio = !!draft && JSON.stringify(draft) !== JSON.stringify(sel);
  const libres = tipos.filter((t) => t.activo && !listas.some((l) => l.tipo === t.nombre)).map((t) => t.nombre);
  const elegir = (l: ListaInspeccion) => { setSelId(l.id); setDraft(structuredClone(l)); setAbierta(0); };
  const upd = (fn: (d: ListaInspeccion) => void) => { if (!draft) return; const d = structuredClone(draft); fn(d); setDraft(d); };
  const mover = (s: number, i: number, dir: -1 | 1) => upd((d) => { const a = d.secciones[s].items; const j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; });

  const actualizar = async () => {
    if (!draft) return;
    // Se descartan ítems y secciones vacíos antes de enviar
    const secciones = draft.secciones.map((s) => ({ titulo: s.titulo.trim(), items: s.items.filter((x) => x.texto.trim()) })).filter((s) => s.titulo && s.items.length);
    setGuardando(true);
    try {
      const l = await api.listas.actualizar(draft.id, { secciones });
      setListas(listas.map((x) => (x.id === l.id ? l : x))); setDraft(structuredClone(l));
      setAviso({ texto: `Lista de ${l.tipo.toLowerCase()} actualizada` });
    } catch (e) { setAviso({ texto: textoError(e), error: true }); }
    finally { setGuardando(false); }
  };
  const crear = async () => {
    if (!nueva?.tipo) return;
    try { const l = await api.listas.crear(nueva.tipo); setListas([...listas, l]); elegir(l); setNueva(null); setAviso({ texto: "Lista creada" }); }
    catch (e) { setAviso({ texto: textoError(e), error: true }); }
  };

  return <>
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-black sm:text-2xl">Listas de inspección</h2><p className="mt-1 text-sm text-slate-500">Cada tipo de equipo tiene una lista. El operario la responde al hacer el check-in.</p></div><button onClick={() => setNueva({ tipo: libres[0] ?? "" })} className={btnPrimary}><Icon name="plus" size={19} />Nueva lista</button></div>
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      <aside className="-mx-4 flex min-w-0 gap-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:block lg:space-y-3 lg:overflow-visible lg:px-0 lg:pb-0">{listas.map((l) => <button key={l.id} onClick={() => elegir(l)} className={`w-64 shrink-0 rounded-2xl border bg-white p-4 text-left lg:w-full ${selId === l.id ? "border-[#F5B800] ring-2 ring-[#F5B800]/20" : "border-slate-200"}`}>
        <div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#F5B800]/15 text-[#8A6500]"><Icon name="equipment" size={19} /></span><div className="min-w-0"><p className="font-black">{l.tipo}</p><p className="mt-0.5 text-xs font-semibold text-slate-400">{l.secciones.length} secciones · {contar(l)} ítems</p></div></div>
      </button>)}</aside>

      {!draft ? <article className={`${card} grid min-h-60 place-items-center p-8 text-center text-sm font-semibold text-slate-400`}>Aún no hay listas. Crea la primera con "Nueva lista".</article> :
      <article className={`${card} min-w-0 overflow-hidden`}>
        <div className="border-b border-slate-200 p-4 sm:p-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between xl:gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-black sm:text-2xl">Lista de {draft.tipo.toLowerCase()}</h3>
              <p className="mt-1 text-sm font-bold text-slate-500">{draft.secciones.length} secciones · {contar(draft)} ítems</p>
            </div>
            <div className="flex gap-2 [&>button]:flex-1 sm:[&>button]:flex-none"><button disabled={!sucio} onClick={() => sel && setDraft(structuredClone(sel))} className={btnGhost}>Descartar</button><button disabled={!sucio || guardando} onClick={actualizar} className={btnPrimary}><Icon name="check" size={19} />{guardando ? "Guardando..." : "Actualizar lista"}</button></div>
          </div>
          {sucio && <div className="mt-4 flex gap-3 rounded-xl bg-blue-50 p-4 text-sm font-semibold text-blue-800"><Icon name="info" className="mt-0.5 shrink-0" /><p>Tienes cambios sin guardar. Al actualizar, las inspecciones que ya se hicieron conservan la lista anterior.</p></div>}
        </div>

        <div className="space-y-3 bg-slate-50/60 p-3 sm:p-5">
          {draft.secciones.map((s, si) => { const open = abierta === si; return <section key={si} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex min-h-[64px] items-center gap-2 px-3 sm:gap-3 sm:px-4">
              <button aria-label={open ? "Cerrar sección" : "Abrir sección"} onClick={() => setAbierta(open ? -1 : si)} className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#F5B800]/15 text-[#8A6500]"><Icon name={open ? "up" : "down"} size={19} /></button>
              <input aria-label="Nombre de la sección" value={s.titulo} onChange={(e) => upd((d) => { d.secciones[si].titulo = e.target.value; })} className="min-w-0 flex-1 rounded-lg px-2 py-1 text-base font-black outline-none hover:bg-slate-50 focus:bg-slate-50" />
              <span className="hidden text-xs font-bold text-slate-400 sm:inline">{s.items.length} ítems</span>
              <button onClick={() => upd((d) => { d.secciones.splice(si, 1); })} title="Eliminar sección" className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"><Icon name="trash" size={18} /></button>
            </div>
            {open && <div className="border-t border-slate-100">
              {s.items.map((x, ii) => <div key={ii} className="flex items-center gap-2 border-b border-slate-100 px-3 py-3 sm:gap-3 sm:px-4">
                <div className="flex flex-col"><button aria-label="Subir" disabled={ii === 0} onClick={() => mover(si, ii, -1)} className="text-slate-400 disabled:text-slate-200"><Icon name="up" size={16} /></button><button aria-label="Bajar" disabled={ii === s.items.length - 1} onClick={() => mover(si, ii, 1)} className="text-slate-400 disabled:text-slate-200"><Icon name="down" size={16} /></button></div>
                <span className="w-5 shrink-0 text-center text-xs font-black text-slate-400">{ii + 1}</span>
                <input value={x.texto} placeholder="Escribe el ítem a revisar" onChange={(e) => upd((d) => { d.secciones[si].items[ii].texto = e.target.value; })} className={`${input} min-h-11 min-w-0 flex-1 border-slate-200`} />
                <button aria-label="Eliminar ítem" onClick={() => upd((d) => { d.secciones[si].items.splice(ii, 1); })} className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"><Icon name="x" size={18} /></button>
              </div>)}
              <button onClick={() => upd((d) => { d.secciones[si].items.push({ texto: "" }); })} className="m-4 h-11 w-[calc(100%-2rem)] rounded-xl border border-dashed border-slate-300 text-sm font-bold text-slate-500">+ Agregar ítem</button>
            </div>}
          </section>; })}
          <button onClick={() => { upd((d) => { d.secciones.push({ titulo: `Sección ${d.secciones.length + 1}`, items: [{ texto: "" }] }); }); setAbierta(draft.secciones.length); }} className="h-12 w-full rounded-xl border-2 border-dashed border-slate-300 bg-white text-sm font-black text-slate-500">+ Agregar sección</button>
        </div>
      </article>}
    </div>

    {nueva && <Drawer title="Nueva lista de inspección" subtitle="Cada tipo de equipo tiene una sola lista." onClose={() => setNueva(null)} footer={<><button className={`${btnGhost} flex-1`} onClick={() => setNueva(null)}>Cancelar</button><button disabled={!nueva.tipo} className={`${btnPrimary} flex-1`} onClick={crear}>Crear lista</button></>}>
      {libres.length === 0 ? <div className="flex gap-3 rounded-xl bg-orange-50 p-4 text-sm font-semibold text-orange-900"><Icon name="info" className="mt-0.5 shrink-0" /><p>Todos los tipos de equipo ya tienen lista. Para crear otra, primero agrega un tipo nuevo en <strong>Equipos y tipos</strong>.</p></div> : <>
        <Field label="Tipo de equipo *"><select className={`${input} w-full border-slate-200`} value={nueva.tipo} onChange={(e) => setNueva({ tipo: e.target.value })}>{libres.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <p className="text-sm font-semibold text-slate-500">Todos los equipos de este tipo usarán esta lista en su inspección diaria.</p>
      </>}
    </Drawer>}
    {aviso && <Toast text={aviso.texto} error={aviso.error} onClose={() => setAviso(null)} />}
  </>;
}
