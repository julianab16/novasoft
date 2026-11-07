// Estructura general: login, control de sesión y panel de administración.
import { useEffect, useState } from "react";
import { Icon, Marca, type IconName } from "./components/ui";
import AccesoDenegado from "./pages/AccesoDenegado";
import CambiarClave from "./pages/CambiarClave";
import EquiposTipos from "./pages/EquiposTipos";
import ListasInspeccion from "./pages/ListasInspeccion";
import Login from "./pages/Login";
import UsuariosRoles from "./pages/UsuariosRoles";
import { alVencerSesion, api } from "./services/api";
import type { Sesion } from "./types";

const MINUTOS_INACTIVIDAD = Number(import.meta.env.VITE_SESION_MINUTOS) || 15;

const paginas: { id: string; titulo: string; icono: IconName; componente: () => JSX.Element }[] = [
  { id: "usuarios", titulo: "Usuarios y roles", icono: "users", componente: UsuariosRoles },
  { id: "equipos", titulo: "Equipos y tipos", icono: "equipment", componente: EquiposTipos },
  { id: "listas", titulo: "Listas de inspección", icono: "clipboard", componente: ListasInspeccion },
];

export default function App() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [expirada, setExpirada] = useState(false);

  const salir = async (porInactividad = false) => {
    await api.auth.logout();
    setSesion(null);
    setExpirada(porInactividad);
  };

  // Si el backend rechaza el token y no se puede renovar, se vuelve al login
  useEffect(() => alVencerSesion(() => { setSesion(null); setExpirada(true); }), []);

  // Cierra la sesión si no hay actividad durante MINUTOS_INACTIVIDAD
  useEffect(() => {
    if (!sesion) return;
    let t = window.setTimeout(() => salir(true), MINUTOS_INACTIVIDAD * 60_000);
    const reiniciar = () => { window.clearTimeout(t); t = window.setTimeout(() => salir(true), MINUTOS_INACTIVIDAD * 60_000); };
    const eventos = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    eventos.forEach((e) => window.addEventListener(e, reiniciar));
    return () => { window.clearTimeout(t); eventos.forEach((e) => window.removeEventListener(e, reiniciar)); };
  }, [sesion]);

  if (!sesion) return <Login sesionExpirada={expirada} onLogin={(s) => { setSesion(s); setExpirada(false); }} />;

  // Con una contraseña temporal, primero hay que cambiarla.
  if (sesion.debeCambiarClave) return <CambiarClave sesion={sesion} onListo={() => setSesion({ ...sesion, debeCambiarClave: false })} onSalir={() => salir()} />;

  // Este front solo incluye las vistas del Administrador.
  if (!sesion.esAdmin) return <main className="min-h-screen bg-[#F5F6F7] p-6"><AccesoDenegado onVolver={() => salir()} textoBoton="Cerrar sesión" /></main>;

  return <PanelAdmin sesion={sesion} onSalir={() => salir()} />;
}

function PanelAdmin({ sesion, onSalir }: { sesion: Sesion; onSalir: () => void }) {
  const leerHash = () => paginas.find((p) => p.id === location.hash.slice(1))?.id ?? paginas[0].id;
  const [pagina, setPagina] = useState(leerHash);
  const [menu, setMenu] = useState(false);
  useEffect(() => { const f = () => setPagina(leerHash()); window.addEventListener("hashchange", f); return () => window.removeEventListener("hashchange", f); }, []);
  const ir = (id: string) => { location.hash = id; setPagina(id); setMenu(false); };
  const actual = paginas.find((p) => p.id === pagina)!;
  const Pagina = actual.componente;
  const iniciales = sesion.nombre.split(" ").map((p) => p[0]).slice(0, 2).join("");

  return <div className="min-h-screen bg-[#F5F6F7]">
    {menu && <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={() => setMenu(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col overflow-y-auto bg-[#242424] p-5 text-white transition-transform lg:translate-x-0 ${menu ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="px-2 py-2"><Marca /></div>
      <p className="mt-8 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Administración</p>
      <nav className="mt-3 space-y-1">{paginas.map((p) => <button key={p.id} onClick={() => ir(p.id)} className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-bold ${pagina === p.id ? "bg-[#F5B800] text-[#2B2B2B]" : "text-white/65 hover:bg-white/5 hover:text-white"}`}><Icon name={p.icono} size={20} />{p.titulo}</button>)}</nav>
      <div className="mt-auto border-t border-white/10 pt-4"><div className="flex items-center gap-3 p-3"><span className="grid size-10 place-items-center rounded-full bg-[#F5B800] font-black text-[#2B2B2B]">{iniciales}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{sesion.nombre}</span><span className="block text-xs text-white/45">{sesion.rol}</span></span><button onClick={onSalir} title="Cerrar sesión" aria-label="Cerrar sesión" className="grid size-10 place-items-center rounded-lg text-white/60 hover:bg-white/5 hover:text-white"><Icon name="logout" size={18} /></button></div></div>
    </aside>
    <main className="min-h-screen lg:ml-[272px]">
      <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:h-[84px] sm:px-8">
        <button aria-label="Abrir menú" onClick={() => setMenu(true)} className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 lg:hidden"><Icon name="menu" size={22} /></button>
        <div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-wider text-[#8A6500]">SIGOPE</p><h1 className="mt-1 truncate text-lg font-black text-[#2B2B2B] sm:text-2xl">Administración del sistema</h1></div>
        <div className="flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-sm font-black">{sesion.nombre}</p><p className="text-xs text-slate-400">{sesion.rol}</p></div><span className="grid size-10 place-items-center rounded-full bg-[#2B2B2B] text-xs font-black text-white">{iniciales}</span></div>
      </header>
      <div className="p-4 sm:p-6 lg:p-8"><Pagina key={actual.id} /></div>
    </main>
  </div>;
}
