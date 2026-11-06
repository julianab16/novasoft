// Componentes y estilos compartidos (mismo estilo del mockup de Figma: amarillo #F5B800, gris #2B2B2B).
import { useEffect } from "react";

export type IconName = "plus" | "search" | "x" | "check" | "users" | "shield" | "equipment" | "clipboard" | "lock" | "key" | "edit" | "up" | "down" | "trash" | "warning" | "arrow" | "info" | "logout" | "menu";
const paths: Record<IconName, JSX.Element> = {
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  x: <path d="m6 6 12 12M18 6 6 18" />,
  check: <path d="m5 12 4 4L19 6" />,
  users: <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-5" /></>,
  equipment: <><path d="M3 16h13l3-5h2v5h-2M6 16V9h8l2 7M8 9V6h5l1 3" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>,
  clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5V3h6v1.5M9 10h6M9 14h6M9 18h4" /></>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M17 6l3 3" /></>,
  edit: <path d="M4 20h4L19 9l-4-4L4 16v4ZM14 6l4 4" />,
  up: <path d="m6 15 6-6 6 6" />,
  down: <path d="m6 9 6 6 6-6" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  warning: <path d="M12 9v4M12 17h.01M10.3 3.7 2.6 18a2 2 0 0 0 1.8 3h15.2a2 2 0 0 0 1.8-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  logout: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
};
export function Icon({ name, size = 20, className = "" }: { name: IconName; size?: number; className?: string }) {
  return <svg aria-hidden="true" className={className} fill="none" height={size} width={size} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
export type Tone = "ok" | "warn" | "danger" | "neutral";
export function Status({ type, children }: { type: Tone; children: React.ReactNode }) {
  const s = { ok: "bg-emerald-50 text-emerald-700 ring-emerald-600/15", warn: "bg-orange-50 text-orange-700 ring-orange-600/15", danger: "bg-red-50 text-red-700 ring-red-600/15", neutral: "bg-slate-100 text-slate-600 ring-slate-500/15" };
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-extrabold ring-1 ring-inset ${s[type]}`}><span className="size-1.5 rounded-full bg-current" />{children}</span>;
}
export const btnPrimary = "flex h-12 shrink-0 whitespace-nowrap items-center justify-center gap-2 rounded-xl bg-[#F5B800] px-5 text-sm font-black text-[#2B2B2B] disabled:opacity-50";
export const btnGhost = "flex h-12 shrink-0 whitespace-nowrap items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-5 text-sm font-extrabold text-slate-700";
export const input = "min-h-12 rounded-xl border-2 bg-white px-4 text-sm font-bold text-[#2B2B2B] outline-none transition focus:border-[#F5B800] focus:ring-4 focus:ring-[#F5B800]/15";

export function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-extrabold text-slate-700">{label}</span>{children}{error && <span className="mt-2 flex items-center gap-1 text-sm font-bold text-red-600"><Icon name="warning" size={16} />{error}</span>}</label>;
}
export function Tabs({ tabs, value, onChange }: { tabs: string[]; value: string; onChange: (t: string) => void }) {
  return <div className="flex w-full rounded-xl bg-slate-200/70 p-1 sm:inline-flex sm:w-auto">{tabs.map((t) => <button key={t} onClick={() => onChange(t)} className={`h-11 flex-1 whitespace-nowrap rounded-lg px-4 sm:flex-none sm:px-5 text-sm font-black ${value === t ? "bg-white text-[#2B2B2B] shadow-sm" : "text-slate-500"}`}>{t}</button>)}</div>;
}
export function Drawer({ title, subtitle, onClose, children, footer }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
    <div className="flex h-full w-full flex-col bg-white shadow-2xl sm:w-[460px]">
      <div className="flex items-start justify-between border-b border-slate-200 p-5 sm:p-6"><div><h2 className="text-xl font-black">{title}</h2>{subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}</div><button aria-label="Cerrar" onClick={onClose} className="grid size-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"><Icon name="x" /></button></div>
      <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">{children}</div>
      <div className="flex gap-3 border-t border-slate-200 p-5">{footer}</div>
    </div>
  </div>;
}
export function Toast({ text, error = false, onClose }: { text: string; error?: boolean; onClose: () => void }) {
  // Se cierra solo a los 4 segundos
  useEffect(() => { const t = window.setTimeout(onClose, 4000); return () => window.clearTimeout(t); }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div role="status" className="fixed bottom-4 left-4 right-4 z-[60] flex items-center sm:bottom-6 sm:left-auto sm:right-6 gap-3 rounded-xl bg-[#2B2B2B] px-5 py-4 text-sm font-bold text-white shadow-2xl"><span className={`grid size-7 shrink-0 place-items-center rounded-full ${error ? "bg-red-500" : "bg-emerald-500"}`}><Icon name={error ? "x" : "check"} size={16} /></span>{text}<button onClick={onClose} className="ml-2 text-white/50"><Icon name="x" size={16} /></button></div>;
}
export const card = "rounded-2xl border border-slate-200 bg-white";
export const th = "px-4 py-3 text-left lg:px-5 text-xs font-black uppercase tracking-wider text-slate-400";
export const td = "px-4 py-4 text-sm lg:px-5";

export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button role="switch" aria-checked={on} onClick={() => onChange(!on)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-emerald-600" : "bg-slate-300"}`}><span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`} /></button>;
}

/** Mensaje y tipo de un aviso flotante. */
export type Aviso = { texto: string; error?: boolean } | null;

/** Convierte cualquier error en un texto para mostrar al usuario. */
export function textoError(e: unknown) {
  return e instanceof Error ? e.message : "Ocurrió un error. Inténtalo de nuevo.";
}

export function Cargando() {
  return <div className="grid min-h-[40vh] place-items-center"><span className="size-8 animate-spin rounded-full border-4 border-slate-200 border-t-[#F5B800]" aria-label="Cargando" /></div>;
}

/** Logo de SIGOPE (igual al mockup). */
export function Marca({ oscuro = true }: { oscuro?: boolean }) {
  return <div className="flex items-center gap-3"><div className="relative grid size-11 place-items-center overflow-hidden rounded-xl bg-[#F5B800] font-black text-[#2B2B2B]"><span className="relative z-10 text-xl">S</span><span className="absolute -bottom-3 -right-3 size-8 rounded-full border-4 border-[#2B2B2B]" /></div><div><div className={`text-xl font-black leading-none ${oscuro ? "text-white" : "text-[#2B2B2B]"}`}>SIGOPE</div><div className={`mt-1 text-[10px] font-bold uppercase tracking-[0.16em] ${oscuro ? "text-white/55" : "text-slate-400"}`}>Triturados el Chocho</div></div></div>;
}
