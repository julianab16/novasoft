// Cambio obligatorio de contraseña: se muestra cuando el usuario ingresa con una contraseña temporal.
import { useState } from "react";
import { Field, Icon, Marca, btnGhost, btnPrimary, erroresDeFormulario, input } from "../components/ui";
import { api } from "../services/api";
import type { Sesion } from "../types";

export default function CambiarClave({ sesion, onListo, onSalir }: { sesion: Sesion; onListo: () => void; onSalir: () => void }) {
  const [actual, setActual] = useState(""); const [nueva, setNueva] = useState(""); const [repetida, setRepetida] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({}); const [general, setGeneral] = useState("");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    const e: Record<string, string> = {};
    if (!actual) e.actual = "Escribe la contraseña temporal que te entregaron.";
    if (nueva.length < 8) e.nueva = "Usa al menos 8 caracteres.";
    else if (nueva !== repetida) e.repetida = "Las contraseñas no coinciden.";
    setErrores(e); setGeneral(""); if (Object.keys(e).length) return;
    setGuardando(true);
    try { await api.auth.cambiarClave(actual, nueva); onListo(); }
    catch (err) { const { campos, resto } = erroresDeFormulario(err, ["actual", "nueva"]); setErrores(campos); setGeneral(resto ?? ""); }
    finally { setGuardando(false); }
  };
  const campo = (k: string) => `${input} min-h-14 w-full text-base ${errores[k] ? "border-red-300" : "border-slate-200"}`;

  return <main className="grid min-h-screen place-items-center bg-[#2B2B2B] px-4 py-8">
    <form className="w-full max-w-[420px]" onSubmit={(e) => { e.preventDefault(); guardar(); }}>
      <div className="mb-6"><Marca /></div>
      <div className="rounded-[24px] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.10)] sm:p-8">
        <span className="grid size-12 place-items-center rounded-xl bg-[#F5B800]/15 text-[#8A6500]"><Icon name="lock" /></span>
        <h2 className="mt-4 text-2xl font-black">Crea tu contraseña</h2>
        <p className="mt-1 text-sm text-slate-500">Hola, {sesion.nombre}. Estás usando una contraseña temporal; cámbiala para continuar.</p>
        {general && <div role="alert" className="mt-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"><Icon name="warning" className="mt-0.5 shrink-0" /><p>{general}</p></div>}
        <div className="mt-5 space-y-4">
          <Field label="Contraseña temporal" error={errores.actual}><input type="password" autoComplete="current-password" className={campo("actual")} value={actual} onChange={(e) => setActual(e.target.value)} /></Field>
          <Field label="Nueva contraseña" error={errores.nueva}><input type="password" autoComplete="new-password" className={campo("nueva")} value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Mínimo 8 caracteres" /></Field>
          <Field label="Repite la nueva contraseña" error={errores.repetida}><input type="password" autoComplete="new-password" className={campo("repetida")} value={repetida} onChange={(e) => setRepetida(e.target.value)} /></Field>
        </div>
        <button type="submit" disabled={guardando} className={`${btnPrimary} mt-6 h-14 w-full text-base`}>{guardando ? "Guardando..." : <>Guardar y continuar <Icon name="arrow" /></>}</button>
        <button type="button" onClick={onSalir} className={`${btnGhost} mt-3 h-12 w-full`}>Cerrar sesión</button>
      </div>
    </form>
  </main>;
}
