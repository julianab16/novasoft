// Se muestra cuando el rol del usuario no tiene permiso para una pantalla.
import { Icon, btnPrimary } from "../components/ui";

export default function AccesoDenegado({ onVolver, textoBoton = "Volver al inicio" }: { onVolver?: () => void; textoBoton?: string }) {
  return <div className="grid min-h-[60vh] place-items-center px-2"><div className="max-w-md text-center">
    <span className="mx-auto grid size-20 place-items-center rounded-full bg-red-50 text-red-600"><Icon name="lock" size={36} /></span>
    <h2 className="mt-6 text-2xl font-black">Acceso denegado</h2>
    <p className="mt-2 text-base leading-relaxed text-slate-500">Tu rol no tiene permiso para usar esta función. Si crees que es un error, comunícate con el administrador.</p>
    {onVolver && <button onClick={onVolver} className={`${btnPrimary} mx-auto mt-7`}>{textoBoton}</button>}
  </div></div>;
}
