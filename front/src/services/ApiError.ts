/** Error que devuelve el backend. `campos` trae los errores por campo (formato de Django REST Framework). */
export class ApiError extends Error {
  constructor(public status: number, public campos: Record<string, string[]> = {}) {
    super(Object.values(campos).flat()[0] ?? `Error ${status}`);
  }
}
