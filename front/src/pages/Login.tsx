// Inicio de sesión. Se muestra cuando no hay sesión: primera entrada, al cerrar sesión o cuando vence por inactividad.
import { useState } from "react";
import { Field, Icon, Marca, btnPrimary, input } from "../components/ui";
import { api, usaDatosDePrueba } from "../services/api";
import type { Sesion } from "../types";

export default function Login({ onLogin, sesionExpirada = false }: { onLogin: (s: Sesion) => void; sesionExpirada?: boolean }) {
  const [usuario, setUsuario] = useState(""); const [clave, setClave] = useState("");
  const [ver, setVer] = useState(false); const [error, setError] = useState(false); const [cargando, setCargando] = useState(false);

  const enviar = async () => {
    if (!usuario.trim() || !clave) return setError(true);
    setError(false); setCargando(true);
    try { onLogin(await api.auth.login(usuario.trim(), clave)); }
    catch { setError(true); } // mensaje genérico: no se dice si falló el usuario o la contraseña
    finally { setCargando(false); }
  };

  return <main className="grid min-h-screen bg-[#2B2B2B] lg:grid-cols-2">
    <section className="relative min-h-[240px] overflow-hidden lg:min-h-0">
      <div className="absolute inset-0 bg-gradient-to-t from-[#2B2B2B] via-[#2B2B2B]/60 to-transparent" />
      <div className="relative flex h-full flex-col justify-between gap-8 p-6 sm:p-10 lg:p-12">
        <Marca />
        <div><h1 className="max-w-md text-3xl font-black leading-tight text-white lg:text-4xl">Operación segura, todos los días.</h1><p className="mt-3 max-w-md text-base text-white/60">Inspecciones, mantenimientos y seguimiento SST en un solo lugar.</p></div>
      </div>
    </section>
    <section className="grid place-items-center rounded-t-[28px] bg-[#F5F6F7] px-4 py-8 sm:p-10 lg:rounded-none">
      <form className="w-full max-w-[420px]" onSubmit={(e) => { e.preventDefault(); enviar(); }}>
        {sesionExpirada && <div className="mb-5 flex gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm font-semibold text-orange-900"><Icon name="lock" className="mt-0.5 shrink-0" /><p>Tu sesión se cerró por inactividad. Ingresa de nuevo para continuar.</p></div>}
        <div className="rounded-[24px] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.10)] sm:p-8">
          <h2 className="text-2xl font-black">Iniciar sesión</h2><p className="mt-1 text-sm text-slate-500">Usa tu cédula o usuario asignado.</p>
          {error && <div role="alert" className="mt-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"><Icon name="warning" className="mt-0.5 shrink-0" /><p>El usuario o la contraseña no son correctos. Revisa e inténtalo de nuevo.</p></div>}
          <div className="mt-5 space-y-4">
            <Field label="Cédula o usuario"><input autoComplete="username" className={`${input} min-h-14 w-full text-base ${error ? "border-red-300" : "border-slate-200"}`} value={usuario} onChange={(e) => setUsuario(e.target.value)} /></Field>
            <Field label="Contraseña"><span className="relative block"><input autoComplete="current-password" className={`${input} min-h-14 w-full pr-20 text-base ${error ? "border-red-300" : "border-slate-200"}`} type={ver ? "text" : "password"} value={clave} onChange={(e) => setClave(e.target.value)} placeholder="Escribe tu contraseña" /><button type="button" onClick={() => setVer(!ver)} className="absolute right-1 top-1/2 min-h-12 -translate-y-1/2 px-3 text-xs font-black text-[#8A6500]">{ver ? "Ocultar" : "Ver"}</button></span></Field>
          </div>
          <button type="submit" disabled={cargando} className={`${btnPrimary} mt-6 h-14 w-full text-base`}>{cargando ? <><span className="size-5 animate-spin rounded-full border-2 border-[#2B2B2B]/25 border-t-[#2B2B2B]" />Ingresando...</> : <>Ingresar <Icon name="arrow" /></>}</button>
          <p className="mt-4 text-center text-sm font-semibold text-slate-500">¿Olvidaste tu contraseña? Pide al administrador que la restablezca.</p>
        </div>
        {usaDatosDePrueba && <p className="mt-4 rounded-xl bg-slate-200/70 p-3 text-center text-xs font-semibold text-slate-600">Modo de prueba (sin backend): usuario <strong>pgomez</strong> · contraseña <strong>Sigope2025</strong></p>}
        <p className="mt-5 text-center text-xs font-semibold text-slate-400">SIGOPE v1.0 · Triturados el Chocho S.A.S.</p>
      </form>
    </section>
  </main>;
}
