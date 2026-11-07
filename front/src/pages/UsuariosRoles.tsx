// Usuarios y roles: gestión de usuarios y permisos por rol.
import { useEffect, useState } from "react";
import { Cargando, ClaveTemporal, Drawer, Field, Icon, Status, Switch, Tabs, Toast, btnGhost, btnPrimary, card, erroresDeFormulario, input, td, textoError, th, type Aviso } from "../components/ui";
import { api } from "../services/api";
import { MODULOS, NIVELES, type Modulo, type Nivel, type Rol, type Usuario } from "../types";

export default function UsuariosRoles() {
  const [tab, setTab] = useState("Usuarios");
  const [roles, setRoles] = useState<Rol[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api.roles.listar().then(setRoles).catch((e) => setError(textoError(e))); }, []);
  if (error) return <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>;
  return <>
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-black sm:text-2xl">Usuarios y roles</h2><p className="mt-1 text-sm text-slate-500">Controla quién usa SIGOPE y qué puede hacer cada perfil.</p></div><Tabs tabs={["Usuarios", "Roles y permisos"]} value={tab} onChange={setTab} /></div>
    {!roles ? <Cargando /> : tab === "Usuarios" ? <Usuarios roles={roles} /> : <Roles roles={roles} setRoles={setRoles} />}
  </>;
}

const vacio: Omit<Usuario, "id"> = { nombre: "", documento: "", usuario: "", rol: "Operario", activo: true };

function Usuarios({ roles }: { roles: Rol[] }) {
  const [lista, setLista] = useState<Usuario[] | null>(null);
  const [q, setQ] = useState(""); const [rol, setRol] = useState("Todos");
  const [form, setForm] = useState<{ id?: number; data: Omit<Usuario, "id"> } | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [reset, setReset] = useState<Usuario | null>(null);
  const [clave, setClave] = useState<{ usuario: string; clave: string } | null>(null);
  const [aviso, setAviso] = useState<Aviso>(null);

  useEffect(() => { api.usuarios.listar().then(setLista).catch((e) => setAviso({ texto: textoError(e), error: true })); }, []);
  if (!lista) return <Cargando />;

  const vistos = lista.filter((u) => (rol === "Todos" || u.rol === rol) && `${u.nombre} ${u.documento} ${u.usuario}`.toLowerCase().includes(q.toLowerCase()));
  const abrir = (u?: Usuario) => { setErrores({}); setForm(u ? { id: u.id, data: { ...u } } : { data: { ...vacio } }); };
  const set = (k: keyof Usuario, v: string | boolean) => form && setForm({ ...form, data: { ...form.data, [k]: v } });

  const guardar = async () => {
    if (!form) return; const d = form.data; const e: Record<string, string> = {};
    if (!d.nombre.trim()) e.nombre = "Escribe el nombre completo.";
    if (!d.documento.trim()) e.documento = "Escribe el número de documento.";
    if (!d.usuario.trim()) e.usuario = "Escribe el nombre de usuario.";
    setErrores(e); if (Object.keys(e).length) return;
    setGuardando(true);
    try {
      if (form.id) {
        const u = await api.usuarios.actualizar(form.id, d);
        setLista(lista.map((x) => (x.id === u.id ? u : x)));
      } else {
        const { claveTemporal, ...u } = await api.usuarios.crear(d);
        setLista([u, ...lista]);
        if (claveTemporal) setClave({ usuario: u.nombre, clave: claveTemporal });
      }
      setAviso({ texto: form.id ? "Cambios guardados" : "Usuario creado" }); setForm(null);
    } catch (err) {
      const { campos, resto } = erroresDeFormulario(err, ["nombre", "documento", "usuario"]);
      setErrores(campos); if (resto) setAviso({ texto: resto, error: true });
    } finally { setGuardando(false); }
  };
  const cambiarEstado = async (u: Usuario) => {
    try {
      const nuevo = await api.usuarios.actualizar(u.id, { activo: !u.activo });
      setLista(lista.map((x) => (x.id === u.id ? nuevo : x)));
      setAviso({ texto: u.activo ? `${u.nombre} fue desactivado. Su historial se conserva.` : `${u.nombre} fue activado` });
    } catch (err) { setAviso({ texto: textoError(err), error: true }); }
  };
  const restablecer = async (u: Usuario) => {
    try { setClave({ usuario: u.nombre, clave: await api.usuarios.restablecerClave(u.id) }); }
    catch (err) { setAviso({ texto: textoError(err), error: true }); }
    setReset(null);
  };

  return <>
    <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4">{([["Usuarios activos", lista.filter((u) => u.activo).length], ["Inactivos", lista.filter((u) => !u.activo).length], ["Operarios", lista.filter((u) => u.rol === "Operario").length], ["Roles", roles.length]] as const).map(([l, v]) => <article key={l} className={`${card} p-5`}><p className="text-sm font-bold text-slate-500">{l}</p><p className="mt-1 text-3xl font-black">{v}</p></article>)}</div>
    <article className={`${card} overflow-hidden`}>
      <div className="flex flex-col gap-3 p-4 sm:p-5 md:flex-row md:items-center">
        <label className="relative min-w-0 flex-1"><Icon name="search" size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} className={`${input} w-full border-slate-200 pl-11`} placeholder="Buscar por nombre, documento o usuario" /></label>
        <select value={rol} onChange={(e) => setRol(e.target.value)} className={`${input} w-full shrink-0 border-slate-200 md:w-56`}><option>Todos</option>{roles.map((r) => <option key={r.id}>{r.nombre}</option>)}</select>
        <button className={btnPrimary} onClick={() => abrir()}><Icon name="plus" size={19} />Nuevo usuario</button>
      </div>
      <ul className="divide-y divide-slate-100 border-t border-slate-100 lg:hidden">{vistos.map((u) => <li key={u.id} className={`p-4 ${u.activo ? "" : "bg-slate-50/60"}`}>
        <div className="flex items-start gap-3"><Iniciales u={u} />
          <div className="min-w-0 flex-1"><p className={`font-black ${u.activo ? "" : "text-slate-400"}`}>{u.nombre}</p><p className="mt-0.5 text-sm font-semibold text-slate-500">{u.rol} · {u.usuario}</p><p className="text-xs font-semibold text-slate-400">C.C. {u.documento}</p></div>
          <Status type={u.activo ? "ok" : "neutral"}>{u.activo ? "Activo" : "Inactivo"}</Status></div>
        <div className="mt-3 grid grid-cols-3 gap-2"><button onClick={() => abrir(u)} className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-slate-100 text-xs font-black text-slate-700"><Icon name="edit" size={16} />Editar</button><button onClick={() => setReset(u)} className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-slate-100 text-xs font-black text-slate-700"><Icon name="key" size={16} />Clave</button><button onClick={() => cambiarEstado(u)} className={`h-11 rounded-xl text-xs font-black ${u.activo ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>{u.activo ? "Desactivar" : "Activar"}</button></div>
      </li>)}</ul>
      <table className="hidden w-full border-t border-slate-100 lg:table">
        <thead className="bg-slate-50"><tr><th className={th}>Nombre</th><th className={th}>Documento</th><th className={th}>Usuario</th><th className={th}>Rol</th><th className={th}>Estado</th><th className={`${th} text-right`}>Acciones</th></tr></thead>
        <tbody>{vistos.map((u) => <tr key={u.id} className={`border-t border-slate-100 ${u.activo ? "" : "bg-slate-50/60 text-slate-400"}`}>
          <td className={td}><div className="flex items-center gap-3"><Iniciales u={u} /><span className="font-black">{u.nombre}</span></div></td>
          <td className={`${td} font-semibold`}>{u.documento}</td><td className={`${td} font-semibold`}>{u.usuario}</td><td className={`${td} font-bold`}>{u.rol}</td>
          <td className={td}><Status type={u.activo ? "ok" : "neutral"}>{u.activo ? "Activo" : "Inactivo"}</Status></td>
          <td className={td}><div className="flex justify-end gap-1">
            <button onClick={() => abrir(u)} title="Editar" className="grid size-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><Icon name="edit" size={18} /></button>
            <button onClick={() => setReset(u)} title="Restablecer contraseña" className="grid size-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><Icon name="key" size={18} /></button>
            <button onClick={() => cambiarEstado(u)} className={`h-10 rounded-lg px-3 text-xs font-black ${u.activo ? "text-red-600 hover:bg-red-50" : "text-emerald-700 hover:bg-emerald-50"}`}>{u.activo ? "Desactivar" : "Activar"}</button>
          </div></td></tr>)}</tbody>
      </table>
      {vistos.length === 0 && <p className="p-10 text-center text-sm font-semibold text-slate-400">No hay usuarios que coincidan con la búsqueda.</p>}
    </article>

    {form && <Drawer title={form.id ? "Editar usuario" : "Nuevo usuario"} subtitle="Los campos marcados con * son obligatorios." onClose={() => setForm(null)} footer={<><button className={`${btnGhost} flex-1`} onClick={() => setForm(null)}>Cancelar</button><button disabled={guardando} className={`${btnPrimary} flex-1`} onClick={guardar}><Icon name="check" size={19} />{guardando ? "Guardando..." : "Guardar"}</button></>}>
      <Field label="Nombre completo *" error={errores.nombre}><input className={`${input} w-full ${errores.nombre ? "border-red-500" : "border-slate-200"}`} value={form.data.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej. Carlos Rodríguez" /></Field>
      <Field label="Número de documento *" error={errores.documento}><input className={`${input} w-full ${errores.documento ? "border-red-500" : "border-slate-200"}`} value={form.data.documento} onChange={(e) => set("documento", e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Cédula sin puntos" /></Field>
      <Field label="Usuario *" error={errores.usuario}><input className={`${input} w-full ${errores.usuario ? "border-red-500" : "border-slate-200"}`} value={form.data.usuario} onChange={(e) => set("usuario", e.target.value.toLowerCase())} placeholder="Ej. crodriguez" /></Field>
      <Field label="Rol *"><select className={`${input} w-full border-slate-200`} value={form.data.rol} onChange={(e) => set("rol", e.target.value)}>{roles.map((r) => <option key={r.id}>{r.nombre}</option>)}</select></Field>
      <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4"><div><p className="text-sm font-black">Usuario activo</p><p className="mt-0.5 text-xs font-semibold text-slate-500">Si lo desactivas, no podrá iniciar sesión.</p></div><Switch on={form.data.activo} onChange={(v) => set("activo", v)} /></div>
      {!form.id && <div className="flex gap-3 rounded-xl bg-blue-50 p-4 text-sm font-semibold text-blue-800"><Icon name="info" className="mt-0.5 shrink-0" /><p>Se generará una contraseña temporal. El usuario deberá cambiarla en su primer ingreso.</p></div>}
    </Drawer>}

    {reset && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40"><div className="w-[calc(100%-2rem)] max-w-[420px] rounded-2xl bg-white p-6 shadow-2xl">
      <span className="grid size-12 place-items-center rounded-xl bg-[#F5B800]/15 text-[#8A6500]"><Icon name="key" /></span>
      <h2 className="mt-4 text-xl font-black">Restablecer contraseña</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">Se generará una contraseña temporal para <strong className="text-slate-800">{reset.nombre}</strong>. Deberá cambiarla al ingresar.</p>
      <div className="mt-6 flex gap-3"><button className={`${btnGhost} flex-1`} onClick={() => setReset(null)}>Cancelar</button><button className={`${btnPrimary} flex-1`} onClick={() => restablecer(reset)}>Restablecer</button></div>
    </div></div>}
    {clave && <ClaveTemporal usuario={clave.usuario} clave={clave.clave} onClose={() => setClave(null)} />}
    {aviso && <Toast text={aviso.texto} error={aviso.error} onClose={() => setAviso(null)} />}
  </>;
}

function Iniciales({ u }: { u: Usuario }) {
  return <span className={`grid size-10 shrink-0 place-items-center rounded-full text-xs font-black lg:size-9 ${u.activo ? "bg-[#F5B800] text-[#2B2B2B]" : "bg-slate-200 text-slate-500"}`}>{u.nombre.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>;
}

const tono: Record<Nivel, string> = { "Sin acceso": "border-slate-400 bg-slate-500 text-white", "Solo ver": "border-blue-600 bg-blue-600 text-white", "Ver y gestionar": "border-emerald-600 bg-emerald-600 text-white" };

function Roles({ roles, setRoles }: { roles: Rol[]; setRoles: (r: Rol[]) => void }) {
  const [selId, setSelId] = useState(roles[0]?.id);
  const sel = roles.find((r) => r.id === selId) ?? roles[0];
  const [permisos, setPermisos] = useState(sel.permisos);
  const [nuevo, setNuevo] = useState<{ nombre: string; consulta: boolean } | null>(null);
  const [aviso, setAviso] = useState<Aviso>(null);
  const esAdmin = sel.nombre === "Administrador"; // siempre tiene acceso total
  const cambios = JSON.stringify(permisos) !== JSON.stringify(sel.permisos);

  const elegir = (r: Rol) => { setSelId(r.id); setPermisos(r.permisos); };
  const guardar = async () => {
    try { const r = await api.roles.guardarPermisos(sel.id, permisos); setRoles(roles.map((x) => (x.id === r.id ? r : x))); setAviso({ texto: "Permisos guardados" }); }
    catch (e) { setAviso({ texto: textoError(e), error: true }); }
  };
  const crear = async () => {
    if (!nuevo?.nombre.trim()) return;
    try { const r = await api.roles.crear(nuevo.nombre.trim(), nuevo.consulta); setRoles([...roles, r]); elegir(r); setNuevo(null); setAviso({ texto: "Rol creado" }); }
    catch (e) { setAviso({ texto: textoError(e), error: true }); }
  };

  return <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
    <article className={`${card} min-w-0 p-4`}>
      <p className="px-2 text-xs font-black uppercase tracking-wider text-slate-400">Roles</p>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">{roles.map((r) => <button key={r.id} onClick={() => elegir(r)} className={`flex min-h-12 shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3 text-left text-sm font-bold lg:w-full lg:whitespace-normal ${sel.id === r.id ? "bg-[#F5B800] text-[#2B2B2B]" : "text-slate-600 hover:bg-slate-50"}`}><Icon name="shield" size={19} /><span className="flex-1">{r.nombre}</span>{!r.base && <span className={`rounded-md px-2 py-0.5 text-[10px] font-black ${sel.id === r.id ? "bg-white/50" : "bg-slate-100 text-slate-500"}`}>ADICIONAL</span>}</button>)}</div>
      <button onClick={() => setNuevo({ nombre: "", consulta: true })} className="mt-3 h-11 w-full rounded-xl border border-dashed border-slate-300 text-sm font-bold text-slate-500">+ Nuevo rol</button>
    </article>
    <article className={`${card} min-w-0 overflow-hidden`}>
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><h3 className="text-lg font-black">Permisos de {sel.nombre}</h3><p className="mt-1 text-sm text-slate-500">Elige qué puede hacer este rol en cada módulo.</p></div><button disabled={!cambios || esAdmin} onClick={guardar} className={btnPrimary}><Icon name="check" size={19} />Guardar cambios</button></div>
      <div className="mx-5 mb-4 grid gap-2 rounded-xl bg-slate-50 p-4 text-xs font-semibold text-slate-600 sm:mx-6 sm:grid-cols-3">
        <p><strong className="text-slate-800">Sin acceso:</strong> no ve el módulo.</p>
        <p><strong className="text-blue-700">Solo ver:</strong> consulta, pero no cambia nada.</p>
        <p><strong className="text-emerald-700">Ver y gestionar:</strong> consulta, crea, edita y desactiva.</p>
      </div>
      <div className="mx-5 mb-4 flex gap-3 rounded-xl bg-blue-50 p-4 text-sm font-semibold text-blue-800 sm:mx-6"><Icon name="info" className="mt-0.5 shrink-0" /><p>{esAdmin ? "El Administrador siempre tiene acceso total a todos los módulos; sus permisos no se pueden cambiar." : "Los cambios se aplican de inmediato en el sistema."}</p></div>
      <ul className="divide-y divide-slate-100 border-t border-slate-100">{MODULOS.map((m: Modulo) => <li key={m} className="flex flex-col gap-3 px-5 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
        <p className="text-sm font-black text-slate-800">{m}</p>
        <div role="radiogroup" aria-label={m} className="grid grid-cols-3 gap-2 md:w-[420px]">{NIVELES.map((n) => { const on = permisos[m] === n; return <button key={n} role="radio" aria-checked={on} disabled={esAdmin} onClick={() => setPermisos({ ...permisos, [m]: n })} className={`flex h-11 items-center justify-center gap-1 rounded-xl border-2 px-1 text-[11px] font-black leading-tight sm:px-2 sm:text-xs ${on ? tono[n] : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>{on && <span className="hidden sm:inline-flex"><Icon name="check" size={14} /></span>}{n}</button>; })}</div>
      </li>)}</ul>
    </article>
    {nuevo && <Drawer title="Nuevo rol" subtitle="Crea un perfil adicional." onClose={() => setNuevo(null)} footer={<><button className={`${btnGhost} flex-1`} onClick={() => setNuevo(null)}>Cancelar</button><button disabled={!nuevo.nombre.trim()} className={`${btnPrimary} flex-1`} onClick={crear}>Crear rol</button></>}>
      <Field label="Nombre del rol *"><input className={`${input} w-full border-slate-200`} value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Ej. Auditor" /></Field>
      <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4"><div><p className="text-sm font-black">Solo consulta</p><p className="mt-0.5 text-xs font-semibold text-slate-500">Empieza con "Solo ver" en todos los módulos.</p></div><Switch on={nuevo.consulta} onChange={(v) => setNuevo({ ...nuevo, consulta: v })} /></div>
    </Drawer>}
    {aviso && <Toast text={aviso.texto} error={aviso.error} onClose={() => setAviso(null)} />}
  </div>;
}
